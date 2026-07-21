const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const VOUCHER_DIR = path.join(UPLOADS_ROOT, 'vouchers');
const ITINERARY_DIR = path.join(UPLOADS_ROOT, 'itineraries');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtINR(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; background: #f8fafc; padding: 24px; }
  .page { max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #0d9488, #0891b2); color: #fff; padding: 28px 32px; }
  .header h1 { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; }
  .header p { opacity: 0.9; margin-top: 6px; font-size: 13px; }
  .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 10px; }
  .body { padding: 28px 32px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .field label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  .field p { font-size: 14px; font-weight: 600; }
  .section { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .section h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0d9488; margin-bottom: 12px; }
  .note { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #115e59; margin-top: 16px; }
  .footer { padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  @media print { body { background: #fff; padding: 0; } .page { border: none; border-radius: 0; } }
`;

function buildVoucherHtml(voucher, booking) {
  const type = voucher.type || 'hotel';
  const typeLabel = { hotel: 'Hotel Voucher', transport: 'Cab / Transport Voucher', activity: 'Activity Voucher', master: 'Master Travel Voucher' }[type] || 'Travel Voucher';
  const details = voucher.details || {};

  let serviceBlock = '';
  if (type === 'hotel' && booking.hotels?.length) {
    serviceBlock = booking.hotels.map((h) => `
      <div class="field"><label>Hotel</label><p>${esc(h.hotelName || h.name)}</p></div>
      <div class="field"><label>Check-in / Check-out</label><p>${fmtDate(h.checkIn)} → ${fmtDate(h.checkOut)}</p></div>
      <div class="field"><label>Room</label><p>${esc(h.roomType || 'Standard')}</p></div>
      <div class="field"><label>Rooms / Meal Plan</label><p>${esc(h.rooms || 1)} room(s) · ${esc(h.mealPlan || 'As booked')}</p></div>
      <div class="field"><label>Confirmation No.</label><p>${esc(h.confirmationNumber || 'To be confirmed')}</p></div>
      <div class="field"><label>Hotel Contact</label><p>${esc(h.contactPerson || 'Reservations')} · ${esc(h.phone || '—')}</p></div>
    `).join('');
  } else if (type === 'transport' && booking.transport?.length) {
    serviceBlock = booking.transport.map((t) => `
      <div class="field"><label>Vehicle</label><p>${esc((t.vehicleType || '').replace(/_/g, ' '))}</p></div>
      <div class="field"><label>Route</label><p>${esc(t.pickupLocation)} → ${esc(t.dropLocation)}</p></div>
      <div class="field"><label>Driver</label><p>${esc(t.driverName)} ${t.driverPhone ? `· ${esc(t.driverPhone)}` : ''}</p></div>
    `).join('');
  } else if (type === 'activity' && booking.activities?.length) {
    serviceBlock = booking.activities.map((a) => `
      <div class="field"><label>Activity</label><p>${esc(a.name || a)}</p></div>
      <div class="field"><label>Scheduled</label><p>${fmtDate(a.scheduledAt)}</p></div>
    `).join('');
  } else if (type === 'master') {
    serviceBlock = `
      <div class="field"><label>Package</label><p>${esc(booking.packageName || booking.destination)}</p></div>
      <div class="field"><label>Travel Period</label><p>${fmtDate(booking.travelDate)} → ${fmtDate(booking.returnDate)}</p></div>
      <div class="field"><label>Passengers</label><p>${booking.adults || 0} Adults, ${booking.children || 0} Children</p></div>
      <div class="field"><label>Total Value</label><p>${fmtINR(booking.totalAmount)}</p></div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${esc(voucher.voucherNumber)}</title>
<style>${BASE_STYLES}</style></head><body>
<div class="page">
  <div class="header">
    <h1>UNO Trips — ${esc(typeLabel)}</h1>
    <p>Voucher No: ${esc(voucher.voucherNumber)} · Booking: ${esc(booking.bookingNumber)}</p>
    <span class="badge">${esc(type)}</span>
  </div>
  <div class="body">
    <div class="grid">
      <div class="field"><label>Guest Name</label><p>${esc(booking.customerName)}</p></div>
      <div class="field"><label>Destination</label><p>${esc(booking.destination)}</p></div>
      <div class="field"><label>Valid From</label><p>${fmtDate(details.validFrom || booking.travelDate)}</p></div>
      <div class="field"><label>Valid Until</label><p>${fmtDate(details.validUntil || booking.returnDate)}</p></div>
    </div>
    ${details.title ? `<div class="field"><label>Title</label><p>${esc(details.title)}</p></div>` : ''}
    <div class="section"><h2>Service Details</h2><div class="grid">${serviceBlock || '<p>Details as per booking confirmation.</p>'}</div></div>
    <div class="section"><h2>Payment Status</h2><div class="grid">
      <div class="field"><label>Package Value</label><p>${fmtINR(booking.totalAmount)}</p></div>
      <div class="field"><label>Received</label><p>${fmtINR(booking.advanceReceived)}</p></div>
      <div class="field"><label>Balance</label><p>${fmtINR(booking.pendingAmount)}</p></div>
    </div></div>
    <div class="note">Present this voucher at check-in / pickup. For support contact your travel executive.</div>
  </div>
  <div class="footer">Generated ${fmtDate(new Date())} · UNO Trips CRM · Print this page to save as PDF</div>
</div>
<script>window.onload=()=>{if(new URLSearchParams(location.search).get('print')==='1')window.print()}</script>
</body></html>`;
}

function buildItineraryHtml(booking) {
  const days = booking.itinerary?.length
    ? booking.itinerary
    : [{ day: 1, title: booking.destination, description: 'Itinerary to be updated by operations.' }];

  const dayBlocks = days.map((d) => `
    <div style="margin-bottom:16px;padding:16px;border:1px solid #e2e8f0;border-radius:10px;">
      <div style="font-size:11px;font-weight:800;color:#0d9488;text-transform:uppercase;">Day ${d.day}</div>
      <div style="font-size:16px;font-weight:700;margin:6px 0;">${esc(d.title)}</div>
      <div style="font-size:13px;color:#475569;white-space:pre-wrap;">${esc(d.description)}</div>
      ${d.accommodation ? `<div style="font-size:12px;color:#0d9488;margin-top:8px;">Stay: ${esc(d.accommodation)}</div>` : ''}
      ${d.transport ? `<div style="font-size:12px;color:#7c3aed;margin-top:8px;">Transport: ${esc(d.transport)}</div>` : ''}
      ${d.meals ? `<div style="font-size:12px;color:#64748b;margin-top:8px;">Meals: ${esc(d.meals)}</div>` : ''}
      ${d.activities ? `<div style="font-size:12px;color:#e11d48;margin-top:8px;">Activities: ${esc(d.activities)}</div>` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Itinerary ${esc(booking.bookingNumber)}</title>
<style>${BASE_STYLES}</style></head><body>
<div class="page">
  <div class="header">
    <h1>Customer Itinerary</h1>
    <p>${esc(booking.customerName)} · ${esc(booking.destination)} · ${esc(booking.bookingNumber)}</p>
  </div>
  <div class="body">
    <div class="grid">
      <div class="field"><label>Travel</label><p>${fmtDate(booking.travelDate)} → ${fmtDate(booking.returnDate)}</p></div>
      <div class="field"><label>Package</label><p>${esc(booking.packageName || '—')}</p></div>
    </div>
    <div class="section"><h2>Day-wise Plan</h2>${dayBlocks}</div>
  </div>
  <div class="footer">UNO Trips · Print this page to save as PDF</div>
</div>
<script>window.onload=()=>{if(new URLSearchParams(location.search).get('print')==='1')window.print()}</script>
</body></html>`;
}

function writeHtmlFile(dir, fileName, html) {
  ensureDir(dir);
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, html, 'utf8');
  const sub = dir === VOUCHER_DIR ? 'vouchers' : 'itineraries';
  return `/uploads/${sub}/${fileName}`;
}

function generateVoucherDocument(voucher, booking) {
  const html = buildVoucherHtml(voucher, booking);
  const safeName = `${voucher.voucherNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.html`;
  return writeHtmlFile(VOUCHER_DIR, safeName, html);
}

function generateItineraryDocument(booking) {
  const html = buildItineraryHtml(booking);
  const safeName = `ITN-${booking.bookingNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.html`;
  return writeHtmlFile(ITINERARY_DIR, safeName, html);
}

module.exports = {
  generateVoucherDocument,
  generateItineraryDocument,
  buildVoucherHtml,
  buildItineraryHtml,
};
