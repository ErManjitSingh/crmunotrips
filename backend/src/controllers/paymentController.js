const Payment = require('../models/Payment');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyPaymentReceived } = require('../services/notificationService');
const { createBookingFromPayment } = require('../services/operationsService');
const { generateAndStoreReceipt } = require('../services/paymentReceiptService');
const { logLeadActivity } = require('../services/leadActivityService');

const PAYMENT_POPULATE = [
  { path: 'lead', select: 'name email phone destination' },
  { path: 'quotation', select: 'quoteNumber pricing' },
  { path: 'booking', select: 'bookingNumber customerName' },
  { path: 'createdBy', select: 'name email' },
];

async function logPaymentActivity({ payment, actor, type, description, meta = {} }) {
  const leadId = payment?.lead?._id || payment?.lead;
  if (!leadId) return;
  await logLeadActivity({
    leadId,
    branchId: payment.branchId || null,
    type,
    description,
    actor,
    meta: { paymentId: payment._id, ...meta },
  }).catch(() => {});
}

const listPayments = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const filter = {
    ...(req.branchId ? { branchId: req.branchId } : {}),
  };
  if (status) filter.status = status;

  let payments = await Payment.find(filter)
    .populate(PAYMENT_POPULATE)
    .sort({ createdAt: -1 })
    .lean();

  if (search) {
    const q = search.toLowerCase();
    payments = payments.filter(
      (p) =>
        p.invoiceNumber?.toLowerCase().includes(q) ||
        p.customerName?.toLowerCase().includes(q)
    );
  }

  res.json(payments);
});

const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate(PAYMENT_POPULATE).lean();
  if (!payment) throw new ApiError(404, 'Payment not found');
  res.json(payment);
});

const createPayment = asyncHandler(async (req, res) => {
  const initialPaid = Number(req.body.paidAmount) || 0;
  const payment = await Payment.create({
    ...req.body,
    installments: initialPaid > 0 ? [{
      amount: initialPaid,
      receivedAt: req.body.paidAt || new Date(),
      method: req.body.method || 'bank_transfer',
      reference: req.body.transactionRef || '',
      note: req.body.notes || 'Initial payment',
      recordedBy: req.user._id,
    }] : [],
    branchId: req.body.branchId || req.branchId || req.user.branchId || null,
    createdBy: req.user._id,
  });

  const populated = await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean();
  if (populated.status === 'paid' || (populated.paidAmount && populated.paidAmount > 0)) {
    notifyPaymentReceived(populated, {
      notifyUserIds: [populated.lead?.assignedTo, populated.createdBy].filter(Boolean),
    }).catch(() => {});
  }
  if (['paid', 'partial'].includes(populated.status)) {
    const booking = await createBookingFromPayment(payment._id, req.user).catch(() => null);
    const receiptPayment = await Payment.findById(payment._id);
    await generateAndStoreReceipt({
      lead: populated.lead,
      payment: receiptPayment,
      booking,
      quotation: populated.quotation,
      actor: req.user,
    }).catch(() => {});
  }
  const refreshed = await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean();
  await logPaymentActivity({
    payment: refreshed,
    actor: req.user,
    type: 'payment_recorded',
    description: `Payment recorded · ₹${Number(refreshed.paidAmount || 0).toLocaleString('en-IN')} / ₹${Number(refreshed.amount || 0).toLocaleString('en-IN')} · ${refreshed.status}`,
    meta: { amount: refreshed.amount, paidAmount: refreshed.paidAmount, status: refreshed.status },
  });
  res.status(201).json(refreshed);
});

const updatePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found');

  const previousStatus = payment.status;
  const previousPaid = Number(payment.paidAmount) || 0;
  const patch = { ...req.body };
  delete patch.installments;
  delete patch.refunds;
  Object.assign(payment, patch);
  const nextPaid = Number(payment.paidAmount) || 0;
  if (nextPaid > previousPaid) {
    payment.installments.push({
      amount: nextPaid - previousPaid,
      receivedAt: req.body.paidAt || new Date(),
      method: req.body.method || payment.method || 'bank_transfer',
      reference: req.body.transactionRef || '',
      note: req.body.installmentNote || req.body.notes || `Payment installment ${payment.installments.length + 1}`,
      recordedBy: req.user._id,
    });
  }
  if (req.body.paidAmount >= payment.amount && payment.status !== 'refunded') {
    payment.status = 'paid';
    payment.paidAt = payment.paidAt || new Date();
  } else if (req.body.paidAmount > 0 && req.body.paidAmount < payment.amount) {
    payment.status = 'partial';
  }

  await payment.save();
  const populated = await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean();
  if (previousStatus !== 'paid' && populated.status === 'paid') {
    notifyPaymentReceived(populated, {
      notifyUserIds: [populated.lead?.assignedTo, populated.createdBy].filter(Boolean),
    }).catch(() => {});
  }
  if (['paid', 'partial'].includes(populated.status)) {
    const booking = await createBookingFromPayment(payment._id, req.user).catch(() => null);
    const receiptPayment = await Payment.findById(payment._id);
    await generateAndStoreReceipt({
      lead: populated.lead,
      payment: receiptPayment,
      booking,
      quotation: populated.quotation,
      actor: req.user,
    }).catch(() => {});
  }
  const refreshed = await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean();
  await logPaymentActivity({
    payment: refreshed,
    actor: req.user,
    type: 'payment_updated',
    description: `Payment updated · ₹${Number(refreshed.paidAmount || 0).toLocaleString('en-IN')} / ₹${Number(refreshed.amount || 0).toLocaleString('en-IN')} · ${refreshed.status}`,
    meta: {
      amount: refreshed.amount,
      paidAmount: refreshed.paidAmount,
      status: refreshed.status,
      previousStatus,
      previousPaid,
    },
  });
  res.json(refreshed);
});

const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  await payment.deleteOne();
  res.json({ message: 'Payment deleted' });
});

const addRefund = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, 'Valid refund amount is required');

  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found');

  payment.refunds.push({
    amount,
    reason: reason || '',
    date: new Date(),
    processedBy: req.user._id,
  });

  const totalRefunded = payment.refunds.reduce((s, r) => s + (r.amount || 0), 0);
  if (totalRefunded >= payment.paidAmount) {
    payment.status = 'refunded';
  }

  await payment.save();
  const populated = await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean();
  await logPaymentActivity({
    payment: populated,
    actor: req.user,
    type: 'payment_refunded',
    description: `Refund ₹${Number(amount).toLocaleString('en-IN')}${reason ? ` — ${reason}` : ''}`,
    meta: { refundAmount: amount, reason: reason || undefined, status: populated.status },
  });
  res.json(populated);
});

module.exports = {
  listPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  addRefund,
};
