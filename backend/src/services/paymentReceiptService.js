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
const RECEIPT_TEMPLATE_VERSION = 4;

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
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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

/** Token amount is taxable; add CGST+SGST @ 2.5% each (matches UNO Trips tax invoice). */
function computeTokenGst(tokenAmount) {
  const subTotal = Math.round((Number(tokenAmount) || 0) * 100) / 100;
  const cgst = Math.round(subTotal * (COMPANY.cgstRate / 100) * 100) / 100;
  const sgst = Math.round(subTotal * (COMPANY.sgstRate / 100) * 100) / 100;
  const grandTotal = Math.round((subTotal + cgst + sgst) * 100) / 100;
  return { subTotal, cgst, sgst, grandTotal };
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
 * Tax Invoice style payment voucher (UNO Trips formal receipt).
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
  const phoneLine = COMPANY.phone || v.customerPhone ? (COMPANY.phone || '') : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Tax Invoice ${escapeHtml(v.invoiceNumber)}</title>
<meta name="receipt-template" content="v${RECEIPT_TEMPLATE_VERSION}"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:10px;background:#eceff3;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:10px;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:640px;margin:0 auto;background:#fff;border:1px solid #000}
  table{width:100%;border-collapse:collapse}
  td,th{border:1px solid #000;padding:4px 6px;vertical-align:top}
  .tal{text-align:left}.tar{text-align:right}.tac{text-align:center}
  .fwb{font-weight:700}
  .logo-wrap{display:flex;align-items:center;gap:6px}
  .logo{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fbbf24,#ea580c 55%,#9a3412);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;flex-shrink:0;border:1.5px solid #c2410c}
  .brand{font-size:15px;font-weight:800;margin:0;line-height:1.05}
  .tag{margin:1px 0 0;font-size:9px;font-weight:600}
  .co-box{font-size:9px;line-height:1.35}
  .co-box strong{font-size:10px}
  .title-row{font-size:11px;font-weight:800;letter-spacing:.03em;text-align:center;padding:4px}
  .terms{background:#ffff00;padding:5px 7px;font-size:9px;line-height:1.3}
  .terms ol{margin:0;padding-left:14px}
  .terms li{margin:1px 0}
  .bank{font-size:9px;font-weight:700;padding:5px 6px}
  .amt{font-variant-numeric:tabular-nums}
  .sum-label{text-align:right;font-weight:700;width:70%}
  .sum-val{text-align:right;font-weight:700;width:30%}
  .grand td{font-size:11px;font-weight:800}
  .foot{padding:4px 6px;font-size:8px;color:#444;border-top:1px solid #000;display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap}
  @media print{body{background:#fff;padding:0}.sheet{max-width:none}}
</style></head>
<body>
<!-- receipt-template-v${RECEIPT_TEMPLATE_VERSION} -->
<div class="sheet">
  <table>
    <tr>
      <td style="width:46%">
        <div class="logo-wrap">
          <div class="logo">UT</div>
          <div>
            <p class="brand">${escapeHtml(COMPANY.brand)}</p>
            <p class="tag">${escapeHtml(COMPANY.tagline)}</p>
          </div>
        </div>
      </td>
      <td style="width:54%" class="co-box">
        <strong>${escapeHtml(COMPANY.name)}</strong><br/>
        <span class="fwb">ADDRESS:</span> ${escapeHtml(COMPANY.address)}<br/>
        <span class="fwb">GST:</span> ${escapeHtml(COMPANY.gstin)}
        &nbsp;·&nbsp; <span class="fwb">PAN:</span> ${escapeHtml(COMPANY.pan)}
        ${phoneLine ? `<br/><span class="fwb">PHONE:</span> ${escapeHtml(phoneLine)}` : ''}
      </td>
    </tr>
    <tr>
      <td colspan="2" class="title-row">TAX INVOICE</td>
    </tr>
    <tr>
      <td>
        <span class="fwb">HSN:</span> ${escapeHtml(COMPANY.hsn)}
        &nbsp;·&nbsp; Original for Recipient<br/>
        <span class="fwb">VOUCHER:</span> ${escapeHtml(v.receiptNumber)}
      </td>
      <td>
        <span class="fwb">INVOICE NO:</span> ${escapeHtml(v.invoiceNumber)}<br/>
        <span class="fwb">INVOICE DATE:</span> ${escapeHtml(v.invoiceDate)}
      </td>
    </tr>
    <tr>
      <td colspan="2">
        <span class="fwb">GUEST:</span> ${escapeHtml(v.customerName)}
        &nbsp;·&nbsp; <span class="fwb">PHONE:</span> ${escapeHtml(v.customerPhone)}
        &nbsp;·&nbsp; ${escapeHtml(v.leadBadge)}
        &nbsp;·&nbsp; <span class="fwb">GSTIN:</span> ${escapeHtml(v.customerGstin || '—')}
      </td>
    </tr>
    <tr>
      <td>
        <span class="fwb">DESTINATION:</span> ${escapeHtml(v.destination)}${v.destinationSub ? `, ${escapeHtml(v.destinationSub)}` : ''}<br/>
        <span class="fwb">TRAVEL:</span> ${escapeHtml(v.travelDate)}${v.travelWeekday ? ` (${escapeHtml(v.travelWeekday)})` : ''}
      </td>
      <td>
        <span class="fwb">BOOKING / QUOTE:</span> ${escapeHtml(quoteOrBooking)}<br/>
        <span class="fwb">PAYMENT:</span> ${escapeHtml(v.paymentMethod)}${v.paymentRef ? ` · ${escapeHtml(v.paymentRef)}` : ''}
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0">
        <table>
          <tr>
            <td class="tac fwb" style="width:33.33%">PACKAGE TOTAL<br/><span class="amt" style="font-size:12px">${escapeHtml(formatAmount(v.totalAmount))}</span></td>
            <td class="tac fwb" style="width:33.33%">ADVANCE / TOKEN<br/><span class="amt" style="font-size:12px">${escapeHtml(formatAmount(v.advanceReceived))}</span></td>
            <td class="tac fwb" style="width:33.33%">BALANCE DUE<br/><span class="amt" style="font-size:12px">${escapeHtml(formatAmount(v.balanceDue))}</span></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table>
    <tr>
      <th class="tal" style="width:70%;padding:3px 6px">PARTICULARS</th>
      <th class="tar" style="width:30%;padding:3px 6px">RATE</th>
    </tr>
    <tr>
      <td class="fwb">TOKEN AMOUNT</td>
      <td class="tar amt">${escapeHtml(formatAmount(v.subTotal))}</td>
    </tr>
    <tr>
      <td class="sum-label">Sub Total</td>
      <td class="sum-val amt">${escapeHtml(formatAmount(v.subTotal, 0))}</td>
    </tr>
    <tr>
      <td class="sum-label">CGST ${COMPANY.cgstRate}%</td>
      <td class="sum-val amt">${escapeHtml(formatAmount(v.cgst, 0))}</td>
    </tr>
    <tr>
      <td class="sum-label">SGST ${COMPANY.sgstRate}%</td>
      <td class="sum-val amt">${escapeHtml(formatAmount(v.sgst, 0))}</td>
    </tr>
    <tr class="grand">
      <td class="sum-label">Grand Total</td>
      <td class="sum-val amt">${escapeHtml(formatAmount(v.grandTotal))}</td>
    </tr>
  </table>

  <div class="terms">
    <ol>
      <li>All payments to be made against the receipt of UNO Trips</li>
      <li>Interest will be charged @ 18% if not paid to us on presentation.</li>
      <li>No claim and discrepancy shall be considered if not send to us in writing only acknowledged by us within three days.</li>
      <li>Please Credit the Amount in our Bank Account as mentioned below:-</li>
      <li>Computer generated Signature are not required.</li>
      <li>All Disputes are subject to HO Shimla</li>
    </ol>
  </div>

  <div class="bank">
    BANK DETAILS: ${escapeHtml(COMPANY.bankName)} A/C NO:- ${escapeHtml(COMPANY.accountNo)}
    &nbsp;&nbsp;IFSC CODE:- ${escapeHtml(COMPANY.ifsc)}
  </div>

  <div class="foot">
    <span>Prepared by ${escapeHtml(executive)}</span>
    <span>${escapeHtml(COMPANY.email)} · ${escapeHtml(COMPANY.website)}</span>
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
  const subject = `UNO Trips — Tax Invoice / Payment Voucher ${payment.receiptNumber || ''}`.trim();
  const text = [
    `Dear ${lead?.name || payment.customerName || 'Customer'},`,
    '',
    `Thank you for choosing UNO Trips for your trip to ${lead?.destination || 'your destination'}.`,
    '',
    `Package total: ${formatINR(total)}`,
    `Advance / token received: ${formatINR(advance)}`,
    `Balance still due: ${formatINR(balance)}`,
    '',
    'Please find your tax invoice / payment voucher in this email.',
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
  COMPANY,
};
