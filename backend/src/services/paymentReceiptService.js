const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Lead = require('../models/Lead');
const Quotation = require('../models/Quotation');
const EmailLog = require('../models/EmailLog');
const ApiError = require('../utils/apiError');
const { enqueueEmailJob } = require('./emailQueueService');
const { isEmailConfigured, normalizeRecipients } = require('./emailService');
const { invalidateMailboxCache } = require('./emailMailboxCache');

/** Bump when HTML layout changes so stored receipts regenerate. */
const RECEIPT_TEMPLATE_VERSION = 7;

const COMPANY = {
  name: 'UNO Trips',
  brand: 'UNO TRIPS',
  tagline: 'Travel made simple',
  address: 'Chauhan Building, 3rd Floor, Kamla Nagar, Bhattakufar, Sanjauli',
  gstin: '02GCOPS8403R1ZR',
  pan: 'GCOPS8403R',
  phone: process.env.COMPANY_PHONE || '',
  email: 'sales@unotrips.com',
  website: 'unotrips.com',
  hsn: '998552',
  bankName: 'STATE BANK OF INDIA',
  accountNo: '42782665189',
  ifsc: 'SBIN0021763',
  cgstRate: 2.5,
  sgstRate: 2.5,
};

function formatINR(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;
}

function formatAmount(amount, decimals = 2) {
  const n = Number(amount) || 0;
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatInvoiceDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  return `${day}-${mon}-${year}`;
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day} · ${time}`;
}

function formatWeekday(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { weekday: 'long' });
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function methodLabel(method) {
  const map = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
  };
  return map[method] || method || '—';
}

function leadBadge(leadId) {
  const digits = String(leadId || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `Lead ${digits}`;
}

/** Advance is GST-inclusive — do not add CGST/SGST on top. */
function computeTokenGst(tokenAmount) {
  const grandTotal = Math.round((Number(tokenAmount) || 0) * 100) / 100;
  return { subTotal: grandTotal, cgst: 0, sgst: 0, grandTotal, gstInclusive: true };
}

function buildVoucherPayload({ lead, payment, booking, quotation }) {
  const total = Number(payment.amount) || 0;
  const advance = Number(payment.paidAmount) || 0;
  const balance = Math.max(0, total - advance);
  const receiptNo = payment.receiptNumber || payment.invoiceNumber || '—';
  const paidAtRaw = payment.paidAt || payment.updatedAt || new Date();
  const travelRaw = lead?.travelDate || booking?.travelDate;
  const dest = lead?.destination || booking?.destination || '—';
  const destParts = String(dest).split(',').map((s) => s.trim()).filter(Boolean);
  const gst = computeTokenGst(advance);

  return {
    receiptNumber: receiptNo,
    invoiceNumber: payment.invoiceNumber || receiptNo,
    invoiceDate: formatInvoiceDate(paidAtRaw),
    invoiceGeneratedOn: formatDate(payment.createdAt || paidAtRaw),
    bookingNumber: booking?.bookingNumber || '—',
    quoteNumber: quotation?.quoteNumber || booking?.quotationReference || '—',
    customerName: lead?.name || payment.customerName || 'Customer',
    customerPhone: lead?.phone || '—',
    customerEmail: lead?.email || '',
    customerGstin: lead?.gstin || lead?.gstNo || '',
    leadBadge: leadBadge(lead?._id),
    destination: destParts[0] || dest,
    destinationSub: destParts[1] || lead?.state || '',
    travelDate: formatDate(travelRaw),
    travelWeekday: formatWeekday(travelRaw),
    paymentMethod: methodLabel(payment.method),
    paymentRef: payment.notes || payment.transactionRef || '',
    paidAtLabel: formatDateTime(paidAtRaw),
    paidAt: paidAtRaw,
    totalAmount: total,
    advanceReceived: advance,
    balanceDue: balance,
    totalLabel: formatINR(total),
    advanceLabel: formatINR(advance),
    balanceLabel: formatINR(balance),
    hsn: COMPANY.hsn,
    subTotal: gst.subTotal,
    cgst: gst.cgst,
    sgst: gst.sgst,
    grandTotal: gst.grandTotal,
    cgstRate: COMPANY.cgstRate,
    sgstRate: COMPANY.sgstRate,
    company: { ...COMPANY },
  };
}

/**
 * Advance / Token Receipt — card layout matching CRM voucher modal.
 */
function buildPaymentReceiptHtml({
  lead,
  payment,
  booking,
  quotation,
  actor,
}) {
  const v = buildVoucherPayload({ lead, payment, booking, quotation });
  const executive = actor?.name || booking?.executiveName || 'UNO Trips Sales';
  const quoteOrBooking = v.quoteNumber !== '—' ? v.quoteNumber : v.bookingNumber;
  const refLine = v.paymentRef ? `Ref: ${escapeHtml(v.paymentRef)}` : 'Confirmed';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Payment Voucher ${escapeHtml(v.receiptNumber)}</title>
<meta name="receipt-template" content="v${RECEIPT_TEMPLATE_VERSION}"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:28px 16px;background:#e8eef3;font-family:Inter,Segoe UI,Arial,Helvetica,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:720px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,.14)}
  .hero{position:relative;background:linear-gradient(135deg,#059669 0%,#047857 55%,#0f766e 100%);color:#fff;padding:28px 28px 26px;overflow:hidden}
  .hero:before,.hero:after{content:"";position:absolute;border-radius:50%;pointer-events:none}
  .hero:before{width:280px;height:280px;right:-60px;top:-120px;background:rgba(255,255,255,.08)}
  .hero:after{width:220px;height:220px;left:-80px;bottom:-100px;background:rgba(0,0,0,.08)}
  .hero-inner{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .brand{font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.88;font-weight:700;margin:0}
  .title{margin:8px 0 0;font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
  .sub{margin:8px 0 0;font-size:13px;opacity:.92}
  .status{background:#fff;border-radius:16px;padding:14px 16px;min-width:168px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
  .status-row{display:flex;align-items:center;gap:10px}
  .check{width:28px;height:28px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .check svg{display:block}
  .status strong{display:block;color:#059669;font-size:14px;font-weight:800}
  .status span{display:block;color:#64748b;font-size:11px;margin-top:2px}
  .body{padding:8px 28px 28px}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #e8eef3;border-radius:16px;overflow:hidden;margin-top:20px}
  .cell{padding:16px 14px;border-right:1px solid #eef2f6;border-bottom:1px solid #eef2f6;min-height:92px}
  .cell:nth-child(3n){border-right:none}
  .cell:nth-child(n+4){border-bottom:none}
  .cell-top{display:flex;align-items:flex-start;gap:10px}
  .ico{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ico svg{width:16px;height:16px}
  .lbl{font-size:11px;color:#94a3b8;font-weight:600;margin:0 0 4px}
  .val{font-size:15px;font-weight:800;color:#0f172a;margin:0;line-height:1.25}
  .meta{font-size:12px;color:#64748b;margin:4px 0 0;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#d1fae5;color:#047857;font-size:10px;font-weight:700}
  .amounts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:18px 0 14px}
  .amt{border-radius:16px;padding:16px 14px;position:relative;overflow:hidden}
  .amt .ai{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
  .amt span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:6px}
  .amt strong{display:block;font-size:22px;font-weight:800;letter-spacing:-.02em}
  .total{background:#ecfdf5}.total span{color:#047857}.total strong{color:#064e3b}.total .ai{background:#a7f3d0;color:#047857}
  .advance{background:#d1fae5}.advance span{color:#047857}.advance strong{color:#064e3b}.advance .ai{background:#6ee7b7;color:#047857}
  .balance{background:#ffedd5}.balance span{color:#c2410c}.balance strong{color:#9a3412}.balance .ai{background:#fdba74;color:#c2410c}
  .company{margin-top:16px;display:grid;grid-template-columns:1.2fr .8fr;gap:12px}
  .panel{border:1px solid #e8eef3;border-radius:14px;padding:14px 16px;background:#f8fafc}
  .panel h3{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:800}
  .panel p{margin:0 0 4px;font-size:12px;line-height:1.45;color:#334155}
  .panel strong{color:#0f172a}
  .tax{margin-top:14px;border:1px solid #e8eef3;border-radius:14px;overflow:hidden}
  .tax table{width:100%;border-collapse:collapse;font-size:12px}
  .tax th,.tax td{padding:9px 14px;border-bottom:1px solid #eef2f6}
  .tax th{text-align:left;background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
  .tax td.tar{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
  .tax tr:last-child td{border-bottom:none;background:#ecfdf5;font-weight:800;font-size:13px;color:#064e3b}
  .bank{margin-top:14px;border-radius:14px;padding:14px 16px;background:#fefce8;border:1px solid #fde68a}
  .bank h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a16207;font-weight:800}
  .bank p{margin:0;font-size:12px;line-height:1.5;color:#713f12;font-weight:600}
  .terms{margin-top:14px;border-radius:14px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a}
  .terms h3{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a16207;font-weight:800}
  .terms ol{margin:0;padding-left:18px}
  .terms li{margin:3px 0;font-size:11px;line-height:1.45;color:#57534e}
  .note{display:flex;gap:12px;align-items:flex-start;background:#eff6ff;border-radius:14px;padding:14px 16px;margin-top:14px}
  .note-ico{width:22px;height:22px;border-radius:50%;background:#3b82f6;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:800;margin-top:1px}
  .note strong{display:block;color:#1d4ed8;font-size:13px;margin-bottom:3px}
  .note p{margin:0;font-size:12px;line-height:1.55;color:#475569}
  .foot{margin-top:18px;padding-top:14px;border-top:1px solid #e8eef3;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  @media (max-width:640px){
    .grid,.amounts,.company{grid-template-columns:1fr}
    .cell{border-right:none!important}
    .cell:nth-child(n+4){border-bottom:1px solid #eef2f6}
    .cell:last-child{border-bottom:none}
  }
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:none}}
</style></head>
<body>
<!-- receipt-template-v${RECEIPT_TEMPLATE_VERSION} -->
<div class="sheet">
  <div class="hero">
    <div class="hero-inner">
      <div>
        <p class="brand">UNO TRIPS</p>
        <h1 class="title">Advance / Token Receipt</h1>
        <p class="sub">Voucher ID: ${escapeHtml(v.receiptNumber)} · ${escapeHtml(v.paidAtLabel)}</p>
      </div>
      <div class="status">
        <div class="status-row">
          <div class="check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div>
            <strong>Payment Received</strong>
            <span>Thank you for your payment</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="body">
    <div class="company">
      <div class="panel">
        <h3>Company</h3>
        <p><strong>${escapeHtml(COMPANY.name)}</strong> · ${escapeHtml(COMPANY.tagline)}</p>
        <p>${escapeHtml(COMPANY.address)}</p>
        <p><strong>GSTIN:</strong> ${escapeHtml(COMPANY.gstin)} &nbsp;·&nbsp; <strong>PAN:</strong> ${escapeHtml(COMPANY.pan)}</p>
        <p><strong>HSN:</strong> ${escapeHtml(COMPANY.hsn)} &nbsp;·&nbsp; Original for Recipient</p>
        ${COMPANY.phone ? `<p><strong>Phone:</strong> ${escapeHtml(COMPANY.phone)}</p>` : ''}
      </div>
      <div class="panel">
        <h3>Guest</h3>
        <p><strong>${escapeHtml(v.customerName)}</strong> · ${escapeHtml(v.leadBadge)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(v.customerPhone)}</p>
        ${v.customerEmail ? `<p><strong>Email:</strong> ${escapeHtml(v.customerEmail)}</p>` : ''}
        <p><strong>GSTIN:</strong> ${escapeHtml(v.customerGstin || '—')}</p>
      </div>
    </div>

    <div class="grid">
      <div class="cell">
        <div class="cell-top">
          <div class="ico" style="background:#d1fae5;color:#059669">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <p class="lbl">Customer</p>
            <p class="val">${escapeHtml(v.customerName)} <span class="badge">${escapeHtml(v.leadBadge)}</span></p>
            <p class="meta"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${escapeHtml(v.customerPhone)}</p>
          </div>
        </div>
      </div>
      <div class="cell">
        <div class="cell-top">
          <div class="ico" style="background:#ede9fe;color:#7c3aed">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <p class="lbl">Destination</p>
            <p class="val">${escapeHtml(v.destination)}</p>
            ${v.destinationSub ? `<p class="meta">${escapeHtml(v.destinationSub)}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="cell">
        <div class="cell-top">
          <div class="ico" style="background:#dbeafe;color:#2563eb">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div>
            <p class="lbl">Travel Date</p>
            <p class="val">${escapeHtml(v.travelDate)}</p>
            ${v.travelWeekday ? `<p class="meta">${escapeHtml(v.travelWeekday)}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="cell">
        <div class="cell-top">
          <div class="ico" style="background:#fef3c7;color:#d97706">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <p class="lbl">Booking / Quote</p>
            <p class="val">${escapeHtml(quoteOrBooking)}</p>
          </div>
        </div>
      </div>
      <div class="cell">
        <div class="cell-top">
          <div class="ico" style="background:#e0e7ff;color:#4f46e5">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          </div>
          <div>
            <p class="lbl">Invoice No.</p>
            <p class="val">${escapeHtml(v.invoiceNumber)}</p>
            <p class="meta">Generated on ${escapeHtml(v.invoiceGeneratedOn)}</p>
          </div>
        </div>
      </div>
      <div class="cell">
        <div class="cell-top">
          <div class="ico" style="background:#fce7f3;color:#db2777">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <div>
            <p class="lbl">Payment Mode</p>
            <p class="val">${escapeHtml(v.paymentMethod)}</p>
            <p class="meta">${refLine}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="amounts">
      <div class="amt total">
        <div class="ai"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div>
        <span>Package Total</span>
        <strong>${escapeHtml(v.totalLabel)}</strong>
      </div>
      <div class="amt advance">
        <div class="ai"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7 7 7-7"/></svg></div>
        <span>Advance Received</span>
        <strong>${escapeHtml(v.advanceLabel)}</strong>
      </div>
      <div class="amt balance">
        <div class="ai"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
        <span>Balance Due</span>
        <strong>${escapeHtml(v.balanceLabel)}</strong>
      </div>
    </div>

    <div class="tax">
      <table>
        <tr><th style="width:70%">Particulars</th><th class="tar" style="text-align:right;width:30%">Amount (₹)</th></tr>
        <tr><td>Advance / Token (GST included)</td><td class="tar">${escapeHtml(formatAmount(v.advanceReceived))}</td></tr>
        <tr><td>Grand Total</td><td class="tar">${escapeHtml(formatAmount(v.advanceReceived))}</td></tr>
      </table>
    </div>

    <div class="bank">
      <h3>Bank Details</h3>
      <p>${escapeHtml(COMPANY.bankName)} &nbsp;·&nbsp; A/C: ${escapeHtml(COMPANY.accountNo)} &nbsp;·&nbsp; IFSC: ${escapeHtml(COMPANY.ifsc)}</p>
    </div>

    <div class="terms">
      <h3>Terms &amp; Conditions</h3>
      <ol>
        <li>All payments to be made against the receipt of UNO Trips.</li>
        <li>Interest will be charged @ 18% if not paid to us on presentation.</li>
        <li>No claim and discrepancy shall be considered if not sent to us in writing and acknowledged by us within three days.</li>
        <li>Please credit the amount in our bank account as mentioned above.</li>
        <li>Computer generated signature is not required.</li>
        <li>All disputes are subject to HO Shimla.</li>
      </ol>
    </div>

    <div class="note">
      <div class="note-ico">i</div>
      <div>
        <strong>Important Note</strong>
        <p>This is an advance receipt for the above booking. Balance payment is required before the travel date.</p>
      </div>
    </div>

    <div class="foot">
      <span>Prepared by ${escapeHtml(executive)}</span>
      <span>${escapeHtml(COMPANY.email)} · ${escapeHtml(COMPANY.website)}</span>
    </div>
  </div>
</div>
</body></html>`;
}

async function nextReceiptNumber() {
  const count = await Payment.countDocuments({ receiptNumber: { $exists: true, $ne: '' } });
  const year = new Date().getFullYear();
  return `PV-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function generateAndStoreReceipt({ lead, payment, booking, quotation, actor }) {
  if (!payment) return null;

  let receiptNumber = payment.receiptNumber;
  if (!receiptNumber) {
    receiptNumber = await nextReceiptNumber();
  }

  const html = buildPaymentReceiptHtml({
    lead,
    payment: { ...payment.toObject?.() || payment, receiptNumber },
    booking,
    quotation,
    actor,
  });

  const updated = await Payment.findByIdAndUpdate(
    payment._id,
    { receiptNumber, receiptHtml: html },
    { new: true }
  );

  return updated;
}

async function sendReceiptToCustomer({ lead, payment, actor }) {
  if (!payment?.receiptHtml) return { sent: false, reason: 'no_receipt' };
  if (!isEmailConfigured()) return { sent: false, reason: 'email_not_configured' };

  const recipients = normalizeRecipients(lead?.email || payment.receiptSentTo);
  if (!recipients.length) return { sent: false, reason: 'no_email' };

  const total = Number(payment.amount) || 0;
  const advance = Number(payment.paidAmount) || 0;
  const balance = Math.max(0, total - advance);
  const subject = `UNO Trips — Payment voucher ${payment.receiptNumber || ''}`.trim();
  const text = [
    `Dear ${lead?.name || payment.customerName || 'Customer'},`,
    '',
    `Thank you for choosing UNO Trips for your trip to ${lead?.destination || 'your destination'}.`,
    '',
    `Package total: ${formatINR(total)}`,
    `Advance / token received: ${formatINR(advance)}`,
    `Balance still due: ${formatINR(balance)}`,
    '',
    'Please find your advance / token receipt in this email.',
    '',
    `Warm regards,`,
    actor?.name || 'UNO Trips Sales Team',
  ].join('\n');

  const log = await EmailLog.create({
    leadId: lead._id,
    quotationId: payment.quotation || null,
    branchId: lead.branchId || null,
    category: 'payment_confirmation',
    to: recipients,
    cc: [],
    bcc: [],
    subject,
    status: 'queued',
    sentBy: actor?._id,
    sentByName: actor?.name || 'System',
    attachmentNames: [`${payment.receiptNumber || 'payment-voucher'}.html`],
    bodyText: text.slice(0, 50000),
  });

  invalidateMailboxCache().catch(() => {});

  enqueueEmailJob({
    logId: log._id,
    leadId: lead._id,
    branchId: lead.branchId,
    category: 'payment_confirmation',
    to: recipients,
    cc: [],
    bcc: [],
    subject,
    html: payment.receiptHtml,
    text,
    attachments: [
      {
        filename: `${payment.receiptNumber || 'payment-voucher'}.html`,
        content: Buffer.from(payment.receiptHtml, 'utf8').toString('base64'),
        encoding: 'base64',
        contentType: 'text/html',
      },
    ],
    actor,
  });

  await Payment.findByIdAndUpdate(payment._id, {
    receiptSentAt: new Date(),
    receiptSentTo: recipients.join(', '),
  });

  return { sent: true, to: recipients, emailLogId: log._id };
}

function summarizePayment(payment, booking) {
  if (!payment && !booking) return null;
  const total = Number(payment?.amount ?? booking?.totalAmount) || 0;
  const advance = Number(payment?.paidAmount ?? booking?.advanceReceived) || 0;
  const balance = Math.max(0, Number(booking?.pendingAmount ?? total - advance) || 0);
  return {
    paymentId: payment?._id || null,
    bookingId: booking?._id || null,
    invoiceNumber: payment?.invoiceNumber || null,
    receiptNumber: payment?.receiptNumber || null,
    bookingNumber: booking?.bookingNumber || null,
    method: payment?.method || null,
    status: payment?.status || booking?.paymentStatus || null,
    totalAmount: total,
    advanceReceived: advance,
    balanceDue: balance,
    dueDate: payment?.dueDate || null,
    receiptSentAt: payment?.receiptSentAt || null,
    receiptSentTo: payment?.receiptSentTo || null,
    hasReceipt: Boolean(payment?.receiptNumber || payment?.receiptHtml),
    paidAt: payment?.paidAt || null,
    bookingCreatedAt: booking?.createdAt || null,
  };
}

/**
 * Batch-attach payment/booking summary for converted lead list rows.
 */
async function attachPaymentSummariesToLeads(leads = []) {
  if (!Array.isArray(leads) || !leads.length) return leads;

  const ids = leads.map((l) => l._id).filter(Boolean);
  if (!ids.length) return leads;

  const [payments, bookings] = await Promise.all([
    Payment.find({ lead: { $in: ids } })
      .select(
        'lead amount paidAmount status method receiptNumber invoiceNumber dueDate receiptSentAt receiptSentTo paidAt createdAt'
      )
      .sort({ createdAt: -1 })
      .lean(),
    Booking.find({ lead: { $in: ids } })
      .select(
        'lead totalAmount advanceReceived pendingAmount paymentStatus bookingNumber createdAt'
      )
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const paymentByLead = new Map();
  for (const p of payments) {
    const key = String(p.lead);
    if (!paymentByLead.has(key)) paymentByLead.set(key, p);
  }
  const bookingByLead = new Map();
  for (const b of bookings) {
    const key = String(b.lead);
    if (!bookingByLead.has(key)) bookingByLead.set(key, b);
  }

  return leads.map((lead) => {
    const key = String(lead._id);
    const paymentSummary = summarizePayment(paymentByLead.get(key), bookingByLead.get(key));
    return paymentSummary ? { ...lead, paymentSummary } : lead;
  });
}

async function getLeadPaymentSummary(leadId) {
  const [payment, booking] = await Promise.all([
    Payment.findOne({ lead: leadId }).sort({ createdAt: -1 }).lean(),
    Booking.findOne({ lead: leadId }).sort({ createdAt: -1 }).lean(),
  ]);
  return summarizePayment(payment, booking);
}

async function getLeadPaymentReceipt(leadId, { branchId, extraFilter = {}, refreshHtml = false } = {}) {
  const lead = await Lead.findOne({
    _id: leadId,
    isDeleted: { $ne: true },
    ...(branchId ? { branchId } : {}),
    ...extraFilter,
  }).lean();
  if (!lead) throw new ApiError(404, 'Lead not found');

  let payment = await Payment.findOne({ lead: leadId }).sort({ createdAt: -1 });
  if (!payment) throw new ApiError(404, 'No payment found for this lead');

  const booking = await Booking.findOne({ lead: leadId }).sort({ createdAt: -1 }).lean();
  const quotation = payment.quotation
    ? await Quotation.findById(payment.quotation).lean()
    : null;

  const needsRefresh =
    refreshHtml ||
    !payment.receiptHtml ||
    !String(payment.receiptHtml).includes(`receipt-template-v${RECEIPT_TEMPLATE_VERSION}`);

  if (needsRefresh) {
    payment = await generateAndStoreReceipt({
      lead,
      payment,
      booking,
      quotation,
      actor: { name: booking?.executiveName || 'UNO Trips' },
    });
  }

  const paymentObj = payment.toObject?.() || payment;
  const voucher = buildVoucherPayload({ lead, payment: paymentObj, booking, quotation });

  return {
    summary: summarizePayment(paymentObj, booking),
    voucher,
    html: payment.receiptHtml,
    lead: {
      _id: lead._id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      destination: lead.destination,
      state: lead.state,
    },
  };
}

module.exports = {
  formatINR,
  buildPaymentReceiptHtml,
  buildVoucherPayload,
  generateAndStoreReceipt,
  sendReceiptToCustomer,
  summarizePayment,
  getLeadPaymentSummary,
  getLeadPaymentReceipt,
  attachPaymentSummariesToLeads,
  COMPANY,
};
