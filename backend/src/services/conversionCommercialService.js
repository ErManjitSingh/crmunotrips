const path = require('path');
const fs = require('fs');
const Lead = require('../models/Lead');
const Payment = require('../models/Payment');
const Quotation = require('../models/Quotation');
const ApiError = require('../utils/apiError');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/address-proofs');
const PAYMENT_SHOT_DIR = path.join(__dirname, '../../uploads/payment-screenshots');

function ensureUploadDir(dir = UPLOAD_DIR) {
  fs.mkdirSync(dir, { recursive: true });
}

function saveBase64Upload({ leadId, base64, originalName, dir, urlPrefix, label }) {
  if (!base64) return null;
  ensureUploadDir(dir);
  const raw = String(base64).replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) return null;
  if (buf.length > 8 * 1024 * 1024) {
    throw new ApiError(400, `${label} must be under 8 MB`);
  }
  const safe = String(originalName || label).replace(/[^\w.\-]+/g, '_');
  const fileName = `${leadId}-${Date.now()}-${safe}`;
  fs.writeFileSync(path.join(dir, fileName), buf);
  return {
    url: `${urlPrefix}/${fileName}`,
    name: originalName || fileName,
  };
}

function saveAddressProofBase64({ leadId, base64, originalName }) {
  return saveBase64Upload({
    leadId,
    base64,
    originalName,
    dir: UPLOAD_DIR,
    urlPrefix: '/uploads/address-proofs',
    label: 'Address proof',
  });
}

function savePaymentScreenshotBase64({ leadId, base64, originalName }) {
  return saveBase64Upload({
    leadId,
    base64,
    originalName,
    dir: PAYMENT_SHOT_DIR,
    urlPrefix: '/uploads/payment-screenshots',
    label: 'Payment screenshot',
  });
}

/** Normalize body into [{ base64, name }] — supports multi + legacy single fields */
function collectPaymentScreenshotUploads(body = {}) {
  const list = [];
  const arr = Array.isArray(body.paymentScreenshots) ? body.paymentScreenshots : [];
  for (const item of arr) {
    if (item?.base64) {
      list.push({ base64: item.base64, name: item.name || 'payment-proof' });
    }
  }
  // Legacy single field only when multi array was not provided (avoid duplicating first image)
  if (!list.length && body.paymentScreenshotBase64) {
    list.push({
      base64: body.paymentScreenshotBase64,
      name: body.paymentScreenshotName || 'payment-proof',
    });
  }
  return list;
}

function applyPaymentScreenshotsToPayment(payment, uploads, leadId) {
  if (!uploads?.length) return payment;
  const existing = Array.isArray(payment.paymentScreenshots)
    ? [...payment.paymentScreenshots]
    : [];
  for (const item of uploads) {
    const shot = savePaymentScreenshotBase64({
      leadId,
      base64: item.base64,
      originalName: item.name,
    });
    if (shot) existing.push({ url: shot.url, name: shot.name });
  }
  payment.paymentScreenshots = existing;
  const primary = existing[0];
  if (primary) {
    payment.paymentScreenshotUrl = primary.url;
    payment.paymentScreenshotName = primary.name;
  }
  return payment;
}

function listPaymentScreenshots(payment) {
  if (!payment) return [];
  if (Array.isArray(payment.paymentScreenshots) && payment.paymentScreenshots.length) {
    return payment.paymentScreenshots
      .filter((s) => s?.url)
      .map((s) => ({ url: s.url, name: s.name || 'Payment proof' }));
  }
  if (payment.paymentScreenshotUrl) {
    return [{ url: payment.paymentScreenshotUrl, name: payment.paymentScreenshotName || 'Payment proof' }];
  }
  return [];
}

function midDate(a, b) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (!Number.isFinite(t1)) return null;
  if (!Number.isFinite(t2)) return new Date(t1 + 3 * 86400000);
  return new Date(Math.round((t1 + t2) / 2));
}

function buildInstallmentSchedule({ total, token, travelDate, returnDate }) {
  const packageTotal = Math.max(0, Number(total) || 0);
  const paid = Math.max(0, Math.min(packageTotal, Number(token) || 0));
  const remaining = Math.max(0, packageTotal - paid);
  const a50 = Math.round(remaining * 0.5);
  const a30 = Math.round(remaining * 0.3);
  const aRest = Math.max(0, remaining - a50 - a30);
  const start = travelDate ? new Date(travelDate) : null;
  const end = returnDate ? new Date(returnDate) : start;
  const due50 = start ? new Date(start.getTime() - 2 * 86400000) : null;
  const due30 = midDate(start, end);
  const dueRest = end || start;

  return [
    {
      label: 'Installment 1 — 50% after token',
      percent: remaining > 0 ? Math.round((a50 / remaining) * 100) : 50,
      amount: a50,
      dueDate: due50,
      status: 'pending',
    },
    {
      label: 'Installment 2 — 30% mid-tour',
      percent: remaining > 0 ? Math.round((a30 / remaining) * 100) : 30,
      amount: a30,
      dueDate: due30,
      status: 'pending',
    },
    {
      label: 'Installment 3 — balance on last tour day',
      percent: remaining > 0 ? Math.round((aRest / remaining) * 100) : 20,
      amount: aRest,
      dueDate: dueRest,
      status: 'pending',
    },
  ].filter((row) => row.amount > 0);
}

async function getCommercialFormDraft({ leadId, executiveId, branchId }) {
  const lead = await Lead.findOne({
    _id: leadId,
    assignedTo: executiveId,
    ...(branchId ? { branchId } : {}),
    isDeleted: { $ne: true },
  }).lean();
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (lead.status !== 'converted') {
    throw new ApiError(400, 'Commercial form is available after lead is converted');
  }

  const quotation = await Quotation.findOne({ lead: leadId }).sort({ updatedAt: -1 }).lean();
  const payment = await Payment.findOne({ lead: leadId }).sort({ createdAt: -1 }).lean();

  const total =
    Number(payment?.amount) ||
    Number(quotation?.pricing?.total) ||
    Number(quotation?.costing2?.grandTotal) ||
    Number(lead.budget) ||
    0;
  const token = Number(payment?.paidAmount) || 0;
  const gstAmount =
    Number(payment?.gstAmount) ||
    Number(quotation?.pricing?.taxes) ||
    Number(quotation?.costing2?.taxes) ||
    0;
  const packageMarginPercent =
    Number(payment?.packageMarginPercent) ||
    Number(quotation?.costing2?.markupPercent) ||
    Number(quotation?.pricing?.markupPercent) ||
    0;
  const totalCost =
    Number(payment?.totalCost) ||
    Number(quotation?.costing2?.baseCost) ||
    Math.max(0, total - Math.round((total * packageMarginPercent) / (100 + packageMarginPercent || 1)));

  const schedule =
    payment?.scheduledInstallments?.length > 0
      ? payment.scheduledInstallments
      : buildInstallmentSchedule({
          total,
          token,
          travelDate: lead.travelDate,
          returnDate: lead.returnDate,
        });

  return {
    lead: {
      _id: lead._id,
      name: lead.name,
      destination: lead.destination,
      travelDate: lead.travelDate,
      returnDate: lead.returnDate,
    },
    quotation: quotation
      ? {
          _id: quotation._id,
          quoteNumber: quotation.quoteNumber,
          packageName: quotation.packageSummary?.packageName || quotation.packageSnapshot?.name,
          costing2: quotation.costing2,
        }
      : null,
    paymentId: payment?._id || null,
    packageMarginPercent,
    totalCost,
    gstAmount,
    amountReceived: token,
    paymentMethod: payment?.method || 'upi',
    totalAmount: total,
    balance: Math.max(0, total - token),
    scheduledInstallments: schedule,
    addressProofUrl: payment?.addressProofUrl || '',
    addressProofName: payment?.addressProofName || '',
    paymentScreenshotUrl: payment?.paymentScreenshotUrl || '',
    paymentScreenshotName: payment?.paymentScreenshotName || '',
    paymentScreenshots: listPaymentScreenshots(payment),
    commercialCompletedAt: payment?.commercialCompletedAt || null,
  };
}

async function saveCommercialForm({ leadId, executiveId, branchId, body }) {
  const draft = await getCommercialFormDraft({ leadId, executiveId, branchId });
  const payment = draft.paymentId
    ? await Payment.findById(draft.paymentId)
    : await Payment.findOne({ lead: leadId }).sort({ createdAt: -1 });

  if (!payment) {
    throw new ApiError(404, 'Payment record not found — convert lead with advance first');
  }

  const totalAmount = Number(body.totalAmount ?? draft.totalAmount) || 0;
  const amountReceived = Number(body.amountReceived ?? draft.amountReceived) || 0;
  const packageMarginPercent = Number(body.packageMarginPercent ?? draft.packageMarginPercent) || 0;
  const totalCost = Number(body.totalCost ?? draft.totalCost) || 0;
  const gstAmount = Number(body.gstAmount ?? draft.gstAmount) || 0;
  const method = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'].includes(body.paymentMethod)
    ? body.paymentMethod
    : payment.method;

  payment.amount = totalAmount;
  payment.paidAmount = amountReceived;
  payment.method = method;
  payment.packageMarginPercent = packageMarginPercent;
  payment.totalCost = totalCost;
  payment.gstAmount = gstAmount;
  payment.scheduledInstallments = buildInstallmentSchedule({
    total: totalAmount,
    token: amountReceived,
    travelDate: draft.lead.travelDate,
    returnDate: draft.lead.returnDate,
  });
  payment.status =
    amountReceived <= 0 ? 'pending' : amountReceived >= totalAmount && totalAmount > 0 ? 'paid' : 'partial';
  payment.commercialCompletedAt = new Date();

  if (body.addressProofBase64) {
    const saved = saveAddressProofBase64({
      leadId,
      base64: body.addressProofBase64,
      originalName: body.addressProofName,
    });
    if (saved) {
      payment.addressProofUrl = saved.url;
      payment.addressProofName = saved.name;
    }
  }

  if (body.paymentScreenshotBase64 || (Array.isArray(body.paymentScreenshots) && body.paymentScreenshots.length)) {
    applyPaymentScreenshotsToPayment(
      payment,
      collectPaymentScreenshotUploads(body),
      leadId
    );
  }

  await payment.save();
  return getCommercialFormDraft({ leadId, executiveId, branchId });
}

module.exports = {
  buildInstallmentSchedule,
  getCommercialFormDraft,
  saveCommercialForm,
  savePaymentScreenshotBase64,
  saveAddressProofBase64,
  collectPaymentScreenshotUploads,
  applyPaymentScreenshotsToPayment,
  listPaymentScreenshots,
};
