/**
 * Live Meta Lead Ads webhook audit (app.unotrips.com only).
 *   $env:VPS_PASSWORD='...'; node deploy/audit-facebook-webhook.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const HOST = process.env.VPS_HOST || '69.62.76.249';
const script = `set +e
echo "== HEALTH =="
curl -sS http://127.0.0.1:5001/api/health; echo
echo "== FB STATUS =="
curl -sS http://127.0.0.1:5001/api/facebook/webhook/status; echo
echo "== GET VERIFY =="
curl -sS -w "\\nHTTP:%{http_code}\\n" "http://127.0.0.1:5001/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=unotrips-fb-verify-2026&hub.challenge=LOCAL_OK"
echo "== ENV FACEBOOK KEYS (masked) =="
grep -E '^FACEBOOK_|^META_|^MONGODB' /var/www/app-unotrips-crm/backend/.env 2>/dev/null | sed -E 's/(TOKEN|SECRET|KEY|URI|PASSWORD)=.*/\\1=***/' || echo missing
echo "== PM2 facebook lines =="
pm2 logs app-unotrips-api --lines 120 --nostream 2>/dev/null | grep -iE 'facebook|webhook|leadgen|hub\\.|signature|Graph' | tail -40 || echo none
echo "== NGINX facebook hits =="
for f in /var/log/nginx/access.log /var/log/nginx/app.unotrips.com.access.log /var/log/nginx/app-access.log; do
  [ -f "\$f" ] && echo "-- \$f" && grep -E 'facebook/webhook|webhooks/facebook' "\$f" | tail -15
done
echo AUDIT_DONE
`;

const c = new Client();
c.on('ready', () => {
  c.exec(script, (err, stream) => {
    if (err) {
      console.error(err);
      c.end();
      process.exit(1);
    }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => {
      c.end();
      process.exit(code || 0);
    });
  });
});
c.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});
c.connect({ host: HOST, port: 22, username: 'root', password: PASSWORD });
