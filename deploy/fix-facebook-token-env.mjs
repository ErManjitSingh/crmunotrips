/**
 * Inspect/fix FACEBOOK_PAGE_ACCESS_TOKEN formatting on live VPS.
 *   $env:VPS_PASSWORD='...'; node deploy/fix-facebook-token-env.mjs
 * Optional: $env:NEW_FACEBOOK_PAGE_ACCESS_TOKEN='EAAx...' to replace
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const NEW_TOKEN = process.env.NEW_FACEBOOK_PAGE_ACCESS_TOKEN || '';
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const replaceBlock = NEW_TOKEN
  ? `
NEW_TOKEN=$(cat <<'TOK'
${NEW_TOKEN}
TOK
)
# trim whitespace/newlines/quotes
NEW_TOKEN=$(printf '%s' "$NEW_TOKEN" | tr -d '\\r\\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
if grep -q '^FACEBOOK_PAGE_ACCESS_TOKEN=' /var/www/app-unotrips-crm/backend/.env; then
  sed -i '/^FACEBOOK_PAGE_ACCESS_TOKEN=/d' /var/www/app-unotrips-crm/backend/.env
fi
echo "FACEBOOK_PAGE_ACCESS_TOKEN=$NEW_TOKEN" >> /var/www/app-unotrips-crm/backend/.env
echo "TOKEN_REPLACED len=\${#NEW_TOKEN}"
pm2 restart app-unotrips-api --update-env
sleep 2
`
  : 'echo NO_REPLACE';

const script = `set +e
ENV=/var/www/app-unotrips-crm/backend/.env
echo "== TOKEN LINE SHAPE =="
LINE=$(grep '^FACEBOOK_PAGE_ACCESS_TOKEN=' "$ENV" || true)
if [ -z "$LINE" ]; then echo MISSING; else
  VAL="\${LINE#FACEBOOK_PAGE_ACCESS_TOKEN=}"
  echo "raw_len=\${#VAL}"
  echo "starts_with=\${VAL:0:8}"
  echo "ends_with=\${VAL: -8}"
  python3 - <<'PY'
import os,re
line=open("/var/www/app-unotrips-crm/backend/.env").read().splitlines()
val=""
for l in line:
  if l.startswith("FACEBOOK_PAGE_ACCESS_TOKEN="):
    val=l.split("=",1)[1]
print("has_quotes", val[:1] in "'\\"" or val[-1:] in "'\\"")
print("has_space", any(c.isspace() for c in val))
print("has_cr", "\\r" in val)
print("has_newline_in_value", "\\n" in val)
print("len", len(val))
# common malformation: wrapping quotes
clean=val.strip().strip('"').strip("'").strip()
print("clean_len", len(clean))
print("same_as_clean", clean==val)
PY
fi
${replaceBlock}
echo "== GRAPH ME =="
TOK=$(grep '^FACEBOOK_PAGE_ACCESS_TOKEN=' "$ENV" | head -1 | cut -d= -f2- | tr -d '\\r\\n' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
curl -sS "https://graph.facebook.com/v21.0/me?access_token=$TOK" | head -c 400; echo
echo FIX_TOKEN_DONE
`;

const c = new Client();
c.on('ready', () => {
  c.exec(script, (err, stream) => {
    if (err) {
      console.error(err);
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
c.connect({
  host: process.env.VPS_HOST || '69.62.76.249',
  port: 22,
  username: 'root',
  password: PASSWORD,
});
