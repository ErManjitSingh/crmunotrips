const Lead = require('../models/Lead');
const Quotation = require('../models/Quotation');
const ApiError = require('../utils/apiError');
const { logLeadActivity } = require('./leadActivityService');
const { assertCanAccessLead } = require('./whatsappContactService');

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function formatPhoneLabel(phone) {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return '';
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `+${digits}`;
}

/**
 * Log quotation WhatsApp send, optionally mark quote as sent, and save alternate phone.
 */
async function sendQuotationViaWhatsApp({
  req,
  leadId,
  quotationId,
  phone,
  saveAsAlternate = false,
}) {
  if (!req.permissions?.whatsapp?.use) {
    throw new ApiError(403, 'You do not have permission to use WhatsApp');
  }

  const digits = normalizePhoneDigits(phone);
  if (!digits || digits.length < 10) {
    throw new ApiError(400, 'A valid phone number is required');
  }

  if (!quotationId) throw new ApiError(400, 'quotationId is required');

  const lead = await assertCanAccessLead(req, leadId);
  const quotation = await Quotation.findOne({
    _id: quotationId,
    lead: lead._id,
  });
  if (!quotation) throw new ApiError(404, 'Quotation not found for this lead');

  if (req.branchId && quotation.branchId && String(quotation.branchId) !== String(req.branchId)) {
    throw new ApiError(404, 'Quotation not found for this lead');
  }

  if (quotation.status === 'pending_approval') {
    throw new ApiError(400, 'Awaiting Team Leader approval before sending to customer');
  }
  if (quotation.status === 'rejected') {
    throw new ApiError(400, 'Rejected quotations cannot be sent');
  }
  if (quotation.status === 'draft') {
    throw new ApiError(400, 'Submit and get approval before sending this quotation');
  }

  const now = new Date();
  const phoneLabel = formatPhoneLabel(digits);
  const wasAlreadySent = ['sent', 'viewed', 'negotiation'].includes(quotation.status);
  let markedSent = false;

  if (!Array.isArray(quotation.timeline)) {
    quotation.timeline = [];
  }

  if (quotation.status === 'approved') {
    quotation.status = 'sent';
    quotation.sentAt = now;
    quotation.timeline.push({
      type: 'sent',
      date: now,
      user: req.user.name,
      notes: `Sent to customer on WhatsApp (${phoneLabel})`,
    });
    await quotation.save();
    markedSent = true;
  } else if (wasAlreadySent) {
    quotation.timeline.push({
      type: 'resent',
      date: now,
      user: req.user.name,
      notes: `Re-sent on WhatsApp (${phoneLabel})`,
    });
    await quotation.save();
  }

  if (saveAsAlternate) {
    const existing = normalizePhoneDigits(lead.alternatePhone);
    const primary = normalizePhoneDigits(lead.phone);
    const wa = normalizePhoneDigits(lead.whatsapp);
    if (digits !== existing && digits !== primary && digits !== wa) {
      lead.alternatePhone = digits.length === 10 ? digits : digits.slice(-10);
    }
  }

  lead.lastContactedAt = now;
  lead.lastContactMethod = 'whatsapp';
  lead.lastContactedBy = req.user._id;
  if (!lead.firstContactAt) lead.firstContactAt = now;

  if (lead.status === 'new' || lead.status === 'contacted') {
    lead.status = 'quotation_sent';
  }
  await lead.save();

  const amount =
    Number(quotation.pricing?.total) ||
    Number(quotation.costing?.grandTotal) ||
    0;
  const pkgName =
    quotation.packageSnapshot?.name ||
    quotation.package?.name ||
    lead.destination ||
    'Package';

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'quotation_sent',
    title: wasAlreadySent && !markedSent ? 'Quotation Re-sent' : 'Quotation Sent',
    description: `${quotation.quoteNumber} sent on WhatsApp to ${phoneLabel} · ${pkgName}${
      amount ? ` · ₹${amount.toLocaleString('en-IN')}` : ''
    }`,
    actor: req.user,
    meta: {
      quotationId: quotation._id,
      quoteNumber: quotation.quoteNumber,
      amount,
      phone: digits,
      phoneLabel,
      channel: 'whatsapp',
      pdfAttached: true,
      resent: wasAlreadySent && !markedSent,
    },
  });

  return {
    leadId: lead._id,
    quotationId: quotation._id,
    quoteNumber: quotation.quoteNumber,
    status: quotation.status,
    phone: digits,
    phoneLabel,
    markedSent,
    alternatePhone: lead.alternatePhone || null,
  };
}

module.exports = {
  sendQuotationViaWhatsApp,
  normalizePhoneDigits,
  formatPhoneLabel,
};
