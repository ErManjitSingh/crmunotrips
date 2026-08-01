const Lead = require('../models/Lead');
const Quotation = require('../models/Quotation');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { createBookingFromPayment } = require('./operationsService');
const { invalidate: invalidateDashboardCache } = require('./dashboardCacheService');
const cacheService = require('./cacheService');
const { notifyUser } = require('./notificationService');
const {
  generateAndStoreReceipt,
  sendReceiptToCustomer,
} = require('./paymentReceiptService');

const TERMINAL_STATUSES = ['converted', 'lost', 'booked_from_another_company'];

function isLeadStatusLocked(status) {
  return TERMINAL_STATUSES.includes(status);
}

async function pickQuotationForLead(leadId) {
  const approved = await Quotation.findOne({ lead: leadId, status: 'approved' }).sort({ updatedAt: -1 });
  if (approved) return approved;
  return Quotation.findOne({
    lead: leadId,
    status: { $in: ['approved', 'sent', 'viewed', 'negotiation', 'pending_approval'] },
  }).sort({ updatedAt: -1 });
}

async function ensureQuotationApproved(quotation, actor) {
  if (!quotation || quotation.status === 'approved') return quotation;
  if (['sent', 'viewed', 'negotiation', 'pending_approval'].includes(quotation.status)) {
    quotation.status = 'approved';
    quotation.approvedBy = actor?._id;
    quotation.timeline = quotation.timeline || [];
    quotation.timeline.push({
      type: 'approved',
      date: new Date(),
      user: actor?.name || 'System',
      notes: 'Auto-approved on lead conversion',
    });
    await quotation.save();
  }
  return quotation;
}

function resolveAdvanceAmount(amount, options = {}) {
  const raw =
    options.advanceAmount != null
      ? options.advanceAmount
      : options.tokenAmount != null
        ? options.tokenAmount
        : null;
  if (raw == null || raw === '') {
    return amount > 0 ? Math.round(amount * 0.3) : 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (amount > 0) return Math.min(n, amount);
  return n;
}

async function ensurePaymentForConversion(lead, quotation, actor, options = {}) {
  const amount = quotation?.pricing?.total || quotation?.costing?.grandTotal || lead.budget || 0;
  const paidAmount = resolveAdvanceAmount(amount, options);
  const method = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'].includes(options.paymentMethod)
    ? options.paymentMethod
    : 'bank_transfer';
  const status = paidAmount >= amount && amount > 0 ? 'paid' : 'partial';

  let payment = await Payment.findOne({ lead: lead._id }).sort({ createdAt: -1 });

  if (payment) {
    const patch = {
      paidAmount,
      status,
      method,
      amount: amount > 0 ? amount : payment.amount,
    };
    if (paidAmount > 0) patch.paidAt = payment.paidAt || new Date();
    if (quotation?._id && !payment.quotation) patch.quotation = quotation._id;
    payment = await Payment.findByIdAndUpdate(payment._id, patch, { new: true });
    return payment;
  }

  const count = await Payment.countDocuments();
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  payment = await Payment.create({
    invoiceNumber,
    branchId: lead.branchId,
    lead: lead._id,
    quotation: quotation?._id,
    customerName: lead.name,
    amount,
    paidAmount,
    status,
    method,
    paidAt: paidAmount > 0 ? new Date() : undefined,
    createdBy: actor?._id || lead.assignedTo,
  });

  return payment;
}

function invalidateDashboards() {
  ['admin', 'sales_manager', 'team_leader', 'sales_executive', 'nav:'].forEach((k) => {
    invalidateDashboardCache(k);
  });
  cacheService.invalidate('ops:').catch(() => {});
}

async function notifyOperationsTeam(lead, booking) {
  const filter = { role: 'operations_manager' };
  if (lead.branchId) filter.branchId = lead.branchId;
  const opsUsers = await User.find(filter).select('_id').lean();
  for (const u of opsUsers) {
    notifyUser(u._id, {
      type: 'operations_task',
      title: 'New booking from converted lead',
      message: `${lead.name} — ${lead.destination}${booking?.bookingNumber ? ` (${booking.bookingNumber})` : ''}`,
      branchId: lead.branchId,
      meta: { bookingId: booking?._id, leadId: lead._id },
    }).catch(() => {});
  }
}

/**
 * @param {object} lead
 * @param {object} actor
 * @param {{ advanceAmount?: number, tokenAmount?: number, paymentMethod?: string, sendReceipt?: boolean, paymentScreenshotBase64?: string, paymentScreenshotName?: string, paymentScreenshots?: Array<{base64:string,name?:string}> }} [options]
 */
async function onLeadConverted(lead, actor, options = {}) {
  const existingBooking = await Booking.findOne({ lead: lead._id });
  let quotation = await pickQuotationForLead(lead._id);
  quotation = await ensureQuotationApproved(quotation, actor);

  if (quotation) {
    const total = quotation.pricing?.total || quotation.costing?.grandTotal || 0;
    if (total > 0 && (!lead.budget || lead.budget < total)) {
      lead.budget = total;
      await Lead.findByIdAndUpdate(lead._id, { budget: total });
    }
  }

  const payment = await ensurePaymentForConversion(lead, quotation, actor, options);

  if (payment) {
    const {
      collectPaymentScreenshotUploads,
      applyPaymentScreenshotsToPayment,
    } = require('./conversionCommercialService');
    const uploads = collectPaymentScreenshotUploads(options);
    if (uploads.length) {
      applyPaymentScreenshotsToPayment(payment, uploads, lead._id);
      await payment.save();
    }
  }

  let booking = existingBooking;
  if (!booking) {
    booking = await createBookingFromPayment(payment._id, actor);
  }

  // Ensure booking advances mirror payment when booking already existed
  if (booking && payment) {
    const total = Number(payment.amount) || Number(booking.totalAmount) || 0;
    const advance = Number(payment.paidAmount) || 0;
    await Booking.findByIdAndUpdate(booking._id, {
      totalAmount: total,
      advanceReceived: advance,
      pendingAmount: Math.max(0, total - advance),
      paymentStatus: payment.status === 'paid' ? 'paid' : payment.status === 'partial' ? 'partial' : 'pending',
    });
    booking = await Booking.findById(booking._id);
  }

  let receipt = null;
  let emailResult = null;
  if (payment) {
    receipt = await generateAndStoreReceipt({
      lead,
      payment,
      booking,
      quotation,
      actor,
    });
    const shouldSend = options.sendReceipt !== false;
    if (shouldSend && receipt) {
      emailResult = await sendReceiptToCustomer({
        lead,
        payment: receipt,
        actor,
      }).catch((err) => {
        console.error('[LeadConversion] receipt email failed:', err.message);
        return { sent: false, reason: err.message };
      });
    }
  }

  if (booking && !existingBooking) {
    await notifyOperationsTeam(lead, booking);
  }

  invalidateDashboards();
  return { booking, payment: receipt || payment, quotation, emailResult };
}

module.exports = {
  onLeadConverted,
  isLeadStatusLocked,
  TERMINAL_STATUSES,
};
