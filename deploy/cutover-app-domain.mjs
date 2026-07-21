import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const MODE = process.argv[2] || 'preflight';
const HOST = process.env.VPS_HOST || '69.62.76.249';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

function exec(conn, script) {
  const encoded = Buffer.from(script).toString('base64');
  const command = `echo ${encoded} | base64 -d | bash`;

  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stderr = '';
      stream.on('data', (data) => process.stdout.write(data));
      stream.stderr.on('data', (data) => {
        stderr += data;
        process.stderr.write(data);
      });
      stream.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `Remote command exited with ${code}`));
      });
    });
  });
}

const preflight = String.raw`set -euo pipefail
SOURCE=/var/www/testing-unotrips-crm
TARGET=/var/www/app-unotrips-crm

echo '=== source ==='
test -d "$SOURCE"
du -sh "$SOURCE"
git -C "$SOURCE" status --short --branch || true

echo '=== capacity ==='
df -h /var/www /var/lib/mongodb
free -h

echo '=== required tools ==='
for cmd in node npm pm2 nginx certbot mongodump mongorestore; do
  command -v "$cmd" >/dev/null && echo "$cmd: OK" || { echo "$cmd: MISSING"; exit 1; }
done

echo '=== target and port ==='
test ! -e "$TARGET" && echo 'target: available' || { echo 'target: already exists'; exit 1; }
if ss -ltn | awk '{print $4}' | grep -qE '(^|:)5001$'; then
  echo 'port 5001: in use'
  exit 1
else
  echo 'port 5001: available'
fi

echo '=== source configuration ==='
grep -E '^(PORT|MONGO_URI|CORS_ORIGINS|REDIS_URL)=' "$SOURCE/backend/.env" \
  | sed -E 's#(mongodb(\+srv)?://)[^/@]+@#\1***@#' || true
grep -E '^(VITE_API_URL|VITE_SOCKET_URL)=' "$SOURCE/frontend/.env" || true

echo '=== database ==='
mongosh --quiet --eval "const d=db.getSiblingDB('testing_unotrips_crm'); printjson({collections:d.getCollectionNames().length,dataSize:d.stats().dataSize,storageSize:d.stats().storageSize})"

echo '=== uploads ==='
du -sh "$SOURCE/backend/uploads" 2>/dev/null || echo 'uploads: none'

echo '=== certificates ==='
test -f /etc/letsencrypt/live/testing.unotrips.com/fullchain.pem && echo 'testing certificate: OK'
test ! -e /etc/letsencrypt/live/app.unotrips.com/fullchain.pem && echo 'app certificate: not issued yet' || echo 'app certificate: already exists'
`;

const deploy = String.raw`set -euo pipefail
SOURCE=/var/www/testing-unotrips-crm
TARGET=/var/www/app-unotrips-crm
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=/var/backups/unotrips-app-cutover-$STAMP

test -d "$SOURCE"
test ! -e "$TARGET"
mkdir -p "$BACKUP"
cp -a /etc/nginx/sites-available/testing.unotrips.com "$BACKUP/testing.unotrips.com.nginx"
pm2 save
cp -a /root/.pm2/dump.pm2 "$BACKUP/dump.pm2" 2>/dev/null || true

echo '=== copying application folder ==='
cp -a "$SOURCE" "$TARGET"
mkdir -p "$TARGET/logs" /var/www/certbot

echo '=== configuring app environment ==='
set_env() {
  local file="$1" key="$2" value="$3"
  if grep -q "^\${key}=" "$file"; then
    sed -i "s#^\${key}=.*#\${key}=\${value}#" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

set_env "$TARGET/backend/.env" PORT 5001
set_env "$TARGET/backend/.env" MONGO_URI mongodb://127.0.0.1:27017/app_unotrips_crm
set_env "$TARGET/backend/.env" CORS_ORIGINS https://app.unotrips.com,https://testing.unotrips.com,https://unotrips.com,https://www.unotrips.com
set_env "$TARGET/backend/.env" REDIS_URL redis://127.0.0.1:6379/1
set_env "$TARGET/frontend/.env" VITE_API_URL https://app.unotrips.com/api
if grep -q '^VITE_SOCKET_URL=' "$TARGET/frontend/.env"; then
  set_env "$TARGET/frontend/.env" VITE_SOCKET_URL https://app.unotrips.com
fi

sed -i 's#https://testing\.unotrips\.com#https://app.unotrips.com#g' \
  "$TARGET/backend/src/controllers/facebookWebhookController.js" \
  "$TARGET/backend/src/controllers/whatsappWebhookController.js" \
  "$TARGET/backend/src/config/env.js" \
  "$TARGET/frontend/src/pages/Login.jsx"

cat > "$TARGET/deploy/ecosystem.app.config.cjs" <<'PM2EOF'
module.exports = {
  apps: [{
    name: 'app-unotrips-api',
    script: 'src/server.js',
    cwd: '/var/www/app-unotrips-crm/backend',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '768M',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      REDIS_URL: 'redis://127.0.0.1:6379/1',
    },
    error_file: '/var/www/app-unotrips-crm/logs/pm2-error.log',
    out_file: '/var/www/app-unotrips-crm/logs/pm2-out.log',
    merge_logs: true,
    time: true,
  }],
};
PM2EOF

echo '=== cloning MongoDB database ==='
mkdir -p "$BACKUP/mongo"
mongodump --quiet --db testing_unotrips_crm --out "$BACKUP/mongo"
mongorestore --quiet --drop --db app_unotrips_crm "$BACKUP/mongo/testing_unotrips_crm"

echo '=== installing and building ==='
cd "$TARGET/backend"
npm ci --omit=dev
cd "$TARGET/frontend"
npm ci
npm run build

echo '=== starting app backend ==='
pm2 start "$TARGET/deploy/ecosystem.app.config.cjs" --update-env
sleep 5
curl --fail --silent --show-error http://127.0.0.1:5001/api/health
echo

echo '=== enabling HTTP app site ==='
cat > /etc/nginx/sites-available/app.unotrips.com <<'NGINXHTTP'
server {
    listen 80;
    listen [::]:80;
    server_name app.unotrips.com;
    root /var/www/app-unotrips-crm/frontend/dist;
    index index.html;
    client_max_body_size 20M;

    location /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 90s;
    }
    location / { try_files $uri $uri/ /index.html; }
}
NGINXHTTP
ln -s /etc/nginx/sites-available/app.unotrips.com /etc/nginx/sites-enabled/app.unotrips.com
nginx -t
systemctl reload nginx
curl --fail --silent --show-error -H 'Host: app.unotrips.com' http://127.0.0.1/api/health
echo

echo '=== issuing TLS certificate ==='
certbot certonly --webroot -w /var/www/certbot -d app.unotrips.com \
  --non-interactive --agree-tos --register-unsafely-without-email

echo '=== enabling HTTPS app site ==='
cat > /etc/nginx/sites-available/app.unotrips.com <<'NGINXHTTPS'
server {
    listen 80;
    listen [::]:80;
    server_name app.unotrips.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.unotrips.com;
    ssl_certificate /etc/letsencrypt/live/app.unotrips.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.unotrips.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    root /var/www/app-unotrips-crm/frontend/dist;
    index index.html;
    client_max_body_size 20M;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml font/woff2;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 90s;
    }
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri =404;
    }
    location / { try_files $uri $uri/ /index.html; }
    location ^~ /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri =404;
    }
}
NGINXHTTPS
nginx -t
systemctl reload nginx
curl --fail --silent --show-error https://app.unotrips.com/api/health
echo

echo '=== switching old domain to compatibility proxy ==='
cat > /etc/nginx/sites-available/testing.unotrips.com <<'NGINXOLD'
server {
    listen 80;
    listen [::]:80;
    server_name testing.unotrips.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location / { return 301 https://app.unotrips.com$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name testing.unotrips.com;
    ssl_certificate /etc/letsencrypt/live/testing.unotrips.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/testing.unotrips.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 90s;
    }
    location / { return 301 https://app.unotrips.com$request_uri; }
}
NGINXOLD
nginx -t
systemctl reload nginx

echo '=== stopping testing backend ==='
pm2 delete testing-unotrips-api
pm2 save

echo '=== final verification ==='
curl --fail --silent --show-error https://app.unotrips.com/api/health
echo
test "$(curl -sS -o /dev/null -w '%{http_code}' https://app.unotrips.com/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://testing.unotrips.com/)" = 301
test "$(curl -sS -o /dev/null -w '%{http_code}' https://testing.unotrips.com/api/health)" = 200
pm2 status
echo "CUTOVER_OK backup=$BACKUP"
`;

const verify = String.raw`set -euo pipefail
echo '=== endpoints ==='
for url in \
  https://app.unotrips.com/ \
  https://app.unotrips.com/api/health \
  https://testing.unotrips.com/ \
  https://testing.unotrips.com/api/health; do
  curl -sS -o /tmp/cutover-response -w "$url -> %{http_code}\n" "$url"
done
echo '=== processes ==='
pm2 status
echo '=== app logs ==='
pm2 logs app-unotrips-api --lines 30 --nostream
echo '=== nginx ==='
nginx -t
`;

const diagnose = String.raw`set -u
echo '=== enabled app site ==='
ls -la /etc/nginx/sites-enabled/app.unotrips.com
sed -n '1,140p' /etc/nginx/sites-available/app.unotrips.com
echo '=== matching nginx configuration ==='
nginx -T 2>&1 | grep -n -A8 -B3 'server_name app\.unotrips\.com' || true
echo '=== local requests ==='
curl -i -H 'Host: app.unotrips.com' http://127.0.0.1/api/health || true
curl -i -H 'Host: app.unotrips.com' http://localhost/api/health || true
echo '=== backend direct ==='
curl -i http://127.0.0.1:5001/api/health || true
`;

const resume = String.raw`set -euo pipefail
TARGET=/var/www/app-unotrips-crm
test -d "$TARGET"
curl --fail --silent --show-error http://127.0.0.1:5001/api/health >/dev/null
curl --fail --silent --show-error -H 'Host: app.unotrips.com' http://127.0.0.1/api/health >/dev/null

echo '=== issuing and enabling TLS ==='
certbot --nginx -d app.unotrips.com --redirect \
  --non-interactive --agree-tos --register-unsafely-without-email
nginx -t
systemctl reload nginx
curl --fail --silent --show-error https://app.unotrips.com/api/health
echo

echo '=== switching old domain to compatibility proxy ==='
cat > /etc/nginx/sites-available/testing.unotrips.com <<'NGINXOLD'
server {
    listen 80;
    listen [::]:80;
    server_name testing.unotrips.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location / { return 301 https://app.unotrips.com$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name testing.unotrips.com;
    ssl_certificate /etc/letsencrypt/live/testing.unotrips.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/testing.unotrips.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 90s;
    }
    location / { return 301 https://app.unotrips.com$request_uri; }
}
NGINXOLD
nginx -t
systemctl reload nginx

echo '=== stopping testing backend ==='
pm2 delete testing-unotrips-api
pm2 save

echo '=== final verification ==='
curl --fail --silent --show-error https://app.unotrips.com/api/health
echo
test "$(curl -sS -o /dev/null -w '%{http_code}' https://app.unotrips.com/)" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' https://testing.unotrips.com/)" = 301
test "$(curl -sS -o /dev/null -w '%{http_code}' https://testing.unotrips.com/api/health)" = 200
pm2 status
echo 'CUTOVER_OK'
`;

const compare = String.raw`set -euo pipefail
mongosh --quiet --eval "
const source=db.getSiblingDB('testing_unotrips_crm');
const target=db.getSiblingDB('app_unotrips_crm');
const names=[...new Set([...source.getCollectionNames(),...target.getCollectionNames()])].sort();
const differences=[];
let sourceTotal=0,targetTotal=0;
for (const name of names) {
  const sourceCount=source.getCollection(name).countDocuments();
  const targetCount=target.getCollection(name).countDocuments();
  sourceTotal+=sourceCount;
  targetTotal+=targetCount;
  if (sourceCount!==targetCount) differences.push({name,sourceCount,targetCount});
}
printjson({sourceCollections:source.getCollectionNames().length,targetCollections:target.getCollectionNames().length,sourceTotal,targetTotal,differences});
"
`;

const metaApi = String.raw`set -euo pipefail
ROOT=/var/www/unotrips-meta
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=/var/backups/unotrips-meta-before-app-api-$STAMP.tar.gz
test -d "$ROOT"

echo '=== current references ==='
grep -RIl --exclude='*.tar.gz' 'https://testing\.unotrips\.com/api/public/leads' "$ROOT"

echo '=== backup ==='
tar -czf "$BACKUP" -C /var/www unotrips-meta
echo "$BACKUP"

echo '=== updating landing-page API ==='
grep -RIlZ --exclude='*.tar.gz' 'https://testing\.unotrips\.com/api/public/leads' "$ROOT" \
  | xargs -0 sed -i 's#https://testing\.unotrips\.com/api/public/leads#https://app.unotrips.com/api/public/leads#g'

echo '=== PHP syntax ==='
while IFS= read -r -d '' file; do
  php -l "$file" >/dev/null
done < <(find "$ROOT" -name crm_lead_push.php -print0)

echo '=== verification ==='
test -z "$(grep -RIl --exclude='*.tar.gz' 'https://testing\.unotrips\.com/api/public/leads' "$ROOT" || true)"
grep -RIl --exclude='*.tar.gz' 'https://app\.unotrips\.com/api/public/leads' "$ROOT"
curl --fail --silent --show-error https://app.unotrips.com/api/health
echo
echo 'META_API_UPDATE_OK'
`;

const scripts = { preflight, deploy, verify, diagnose, resume, compare, metaApi };
if (!scripts[MODE]) {
  console.error(`Unknown mode: ${MODE}`);
  process.exit(1);
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    await exec(conn, scripts[MODE]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
});
conn.on('error', (error) => {
  console.error(`SSH error: ${error.message}`);
  process.exit(1);
});
conn.connect({
  host: HOST,
  port: 22,
  username: 'root',
  password: PASSWORD,
  readyTimeout: 30000,
});
