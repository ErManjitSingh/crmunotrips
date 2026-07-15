const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Lead = require('../models/Lead');
const Quotation = require('../models/Quotation');
const EmailLog = require('../models/EmailLog');
const ApiError = require('../utils/apiError');
const { enqueueEmailJob } = require('./emailQueueService');
const { isEmailConfigured, normalizeRecipients } = require('./emailService');
const { invalidateMailboxCache } = require('./emailMailboxCache');

function formatINR(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

/**
 * Standalone printable advance / token payment voucher (HTML).
 */
function buildPaymentReceiptHtml({
  lead,
  payment,
  booking,
  quotation,
  actor,
}) {
  const total = Number(payment.amount) || 0;
  const advance = Number(payment.paidAmount) || 0;
  const balance = Math.max(0, total - advance);
  const receiptNo = payment.receiptNumber || payment.invoiceNumber || '—';
  const bookingNo = booking?.bookingNumber || '—';
  const quoteNo = quotation?.quoteNumber || booking?.quotationReference || '—';
  const destination = lead?.destination || booking?.destination || '—';
  const travelDate = formatDate(lead?.travelDate || booking?.travelDate);
  const paidAt = formatDate(payment.paidAt || payment.updatedAt || new Date());
  const executive = actor?.name || booking?.executiveName || 'UNO Trips Sales';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Payment Voucher ${escapeHtml(receiptNo)}</title>
<style>
  body{margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;}
  .sheet{max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.12);}
  .head{background:linear-gradient(135deg,#059669,#0d9488);color:#fff;padding:28px 28px 22px;}
  .brand{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;font-weight:700;}
  .title{margin:8px 0 0;font-size:26px;font-weight:800;}
  .sub{margin:6px 0 0;font-size:13px;opacity:.9;}
  .body{padding:24px 28px 28px;}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}
  .meta div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;}
  .meta span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700;}
  .meta strong{display:block;margin-top:4px;font-size:14px;}
  .amounts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:8px 0 20px;}
  .amt{border-radius:14px;padding:16px 14px;text-align:center;}
  .amt span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:6px;}
  .amt strong{display:block;font-size:20px;font-weight:800;}
  .total{background:#f1f5f9;border:1px solid #e2e8f0;color:#0f172a;}
  .advance{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;}
  .balance{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;}
  .note{font-size:13px;line-height:1.6;color:#475569;background:#f8fafc;border-radius:12px;padding:14px 16px;border:1px dashed #cbd5e1;}
  .foot{margin-top:22px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}}
</style></head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="brand">UNO Trips · Payment Voucher</div>
      <h1 class="title">Advance / Token Receipt</h1>
      <p class="sub">Voucher ${escapeHtml(receiptNo)} · ${escapeHtml(paidAt)}</p>
    </div>
    <div class="body">
      <div class="meta">
        <div><span>Customer</span><strong>${escapeHtml(lead?.name || payment.customerName || 'Customer')}</strong></div>
        <div><span>Destination</span><strong>${escapeHtml(destination)}</strong></div>
        <div><span>Travel date</span><strong>${escapeHtml(travelDate)}</strong></div>
        <div><span>Booking / Quote</span><strong>${escapeHtml(bookingNo)} · ${escapeHtml(quoteNo)}</strong></div>
        <div><span>Payment mode</span><strong>${escapeHtml(methodLabel(payment.method))}</strong></div>
        <div><span>Invoice</span><strong>${escapeHtml(payment.invoiceNumber || '—')}</strong></div>
      </div>

      <div class="amounts">
        <div class="amt total"><span>Package Total</span><strong>${escapeHtml(formatINR(total))}</strong></div>
        <div class="amt advance"><span>Advance Received</span><strong>${escapeHtml(formatINR(advance))}</strong></div>
        <div class="amt balance"><span>Balance Due</span><strong>${escapeHtml(formatINR(balance))}</strong></div>
      </div>

      <div class="note">
        Thank you for booking with UNO Trips. We have received an advance/token of
        <strong>${escapeHtml(formatINR(advance))}</strong>.
        Remaining amount of <strong>${escapeHtml(formatINR(balance))}</strong> is due before travel
        (or as per your payment plan). Please keep this voucher for your records.
      </div>

      <div class="foot">
        <span>Prepared by ${escapeHtml(executive)}</span>
        <span>sales@unotrips.com · unotrips.com</span>
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
    'Please find your payment voucher attached (and in this email).',
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
    receiptSentAt: payment?.receiptSentAt || null,
    receiptSentTo: payment?.receiptSentTo || null,
    hasReceipt: Boolean(payment?.receiptHtml || payment?.receiptNumber),
    paidAt: payment?.paidAt || null,
  };
}

async function getLeadPaymentSummary(leadId) {
  const [payment, booking] = await Promise.all([
    Payment.findOne({ lead: leadId }).sort({ createdAt: -1 }).lean(),
    Booking.findOne({ lead: leadId }).sort({ createdAt: -1 }).lean(),
  ]);
  return summarizePayment(payment, booking);
}

async function getLeadPaymentReceipt(leadId, { branchId, extraFilter = {} } = {}) {
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

  if (!payment.receiptHtml) {
    payment = await generateAndStoreReceipt({
      lead,
      payment,
      booking,
      quotation,
      actor: { name: booking?.executiveName || 'UNO Trips' },
    });
  }

  return {
    summary: summarizePayment(payment.toObject?.() || payment, booking),
    html: payment.receiptHtml,
    lead: { _id: lead._id, name: lead.name, email: lead.email, destination: lead.destination },
  };
}

module.exports = {
  formatINR,
  buildPaymentReceiptHtml,
  generateAndStoreReceipt,
  sendReceiptToCustomer,
  summarizePayment,
  getLeadPaymentSummary,
  getLeadPaymentReceipt,
};
