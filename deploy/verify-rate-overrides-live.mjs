/**
 * Verify ops rate override applied to Hydrangea hotel detail.
 *   $env:VPS_PASSWORD='...'; node deploy/verify-rate-overrides-live.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD || 'Manjitsingh-123';

const remote = `
cd /var/www/app-unotrips-crm/backend
# ensure ops creds from uno-backend
if [ -f /var/www/uno-backend/.env ]; then
  OPS_USER=$(grep '^OPS_USERNAME=' /var/www/uno-backend/.env | cut -d= -f2- | tr -d '\r')
  OPS_PASS=$(grep '^OPS_PASSWORD=' /var/www/uno-backend/.env | cut -d= -f2- | tr -d '\r')
  grep -q '^UNO_HOTELS_OPS_USERNAME=' .env 2>/dev/null || echo "UNO_HOTELS_OPS_USERNAME=$OPS_USER" >> .env
  grep -q '^UNO_HOTELS_OPS_PASSWORD=' .env 2>/dev/null || echo "UNO_HOTELS_OPS_PASSWORD=$OPS_PASS" >> .env
  grep -q '^UNO_HOTELS_RATE_OVERRIDE_CHANNEL=' .env 2>/dev/null || echo 'UNO_HOTELS_RATE_OVERRIDE_CHANNEL=staff' >> .env
fi
node <<'NODE'
require('dotenv').config();
const { getUnoHotelDetail } = require('./src/services/unoHotelsHotelService');
(async () => {
  const detail = await getUnoHotelDetail({
    city: 'Shimla',
    slug: 'hotel-hydrangea-heights-shimla-shimla',
    checkIn: '2026-08-15',
  });
  console.log('Hotel', detail.name, detail.id);
  for (const room of detail.rooms || []) {
    console.log('ROOM', room.name, 'MAP', room.rates?.map, 'EP', room.rates?.ep, 'override', room.rawMealPlans?._opsRateOverride || 'via rates');
  }
  const superior = (detail.rooms || []).find(r => /superior/i.test(r.name));
  if (superior) {
    console.log('SUPERIOR rates', JSON.stringify(superior.rates));
    console.log('Expected MAP override ~2000 for Aug 2026');
  }
})().catch(e => { console.error(e); process.exit(1); });
NODE
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(remote, (err, stream) => {
    if (err) { console.error(err); process.exit(1); }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => { conn.end(); process.exit(code || 0); });
  });
}).connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
