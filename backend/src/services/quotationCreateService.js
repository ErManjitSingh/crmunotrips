const Quotation = require('../models/Quotation');
const ApiError = require('../utils/apiError');
const { generateQuoteNumber, QUOTATION_POPULATE } = require('../utils/queryHelpers');
const { logActivity, getClientIp } = require('./activityService');
const { logLeadActivity } = require('./leadActivityService');
const { notifyQuotationCreated } = require('./notificationService');
const { resolvePackageReference } = require('../utils/packageRef');

async function persistQuotation({
  req,
  lead,
  body,
  status,
  timeline,
  createdByExecutiveId,
  teamLeaderId,
  approvalNote,
}) {
  const quotation = await Quotation.create({
    quoteNumber: body.quoteNumber || generateQuoteNumber(),
    lead: lead._id,
    package: resolvePackageReference(body.packageId),
    packageSnapshot: body.package,
    status,
    pricing: body.pricing,
    selectedHotels: body.selectedHotels || [],
    selectedCabs: body.selectedCabs || [],
    selectedFlights: body.selectedFlights || [],
    selectedActivities: body.selectedActivities || [],
    customizations: body.customizations,
    createdByExecutive: createdByExecutiveId || lead.assignedTo || req.user._id,
    branchId: req.branchId || lead.branchId || req.user.branchId || null,
    teamLeader: teamLeaderId || body.teamLeader,
    timeline,
    createdBy: req.user._id,
  });

  if (status === 'pending_approval' && lead.status === 'new') {
    lead.status = 'quotation_sent';
    await lead.save();
  }

  await logActivity({
    type: 'quotation_created',
    user: req.user.name,
    userId: req.user._id,
    action: approvalNote || (status === 'draft' ? 'Saved quote draft' : 'Created quotation'),
    target: quotation.quoteNumber,
    ip: getClientIp(req),
    branchId: req.branchId || lead.branchId || req.user.branchId || null,
  });

  const branchId = req.branchId || lead.branchId || req.user.branchId || null;
  const quoteTotal =
    Number(quotation.pricing?.total) ||
    Number(quotation.costing?.grandTotal) ||
    Number(body.pricing?.total) ||
    0;
  const pkgName = body.package?.name || lead.destination || 'Package';
  const priceLabel = `₹${Number(quoteTotal).toLocaleString('en-IN')}`;
  await logLeadActivity({
    leadId: lead._id,
    branchId,
    type: 'quotation_created',
    description: `${quotation.quoteNumber} · ${pkgName} · ${priceLabel} · ${status.replace(/_/g, ' ')}`,
    actor: req.user,
    meta: {
      quotationId: quotation._id,
      quoteNumber: quotation.quoteNumber,
      status,
      amount: quoteTotal,
    },
  });

  if (status === 'pending_approval') {
    await logLeadActivity({
      leadId: lead._id,
      branchId,
      type: 'quotation_submitted',
      title: 'Quotation Submitted',
      description: `${quotation.quoteNumber} submitted for approval · ${pkgName} · ${priceLabel}`,
      actor: req.user,
      meta: {
        quotationId: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status,
        amount: quoteTotal,
      },
    });
  } else if (status === 'approved') {
    await logLeadActivity({
      leadId: lead._id,
      branchId,
      type: 'quotation_approved',
      description: `${quotation.quoteNumber} approved · ${pkgName} · ${priceLabel}`,
      actor: req.user,
      meta: {
        quotationId: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status,
        amount: quoteTotal,
      },
    });
  } else if (status === 'sent') {
    await logLeadActivity({
      leadId: lead._id,
      branchId,
      type: 'quotation_sent',
      description: `${quotation.quoteNumber} sent to customer · ${pkgName} · ${priceLabel}`,
      actor: req.user,
      meta: {
        quotationId: quotation._id,
        quoteNumber: quotation.quoteNumber,
        amount: quoteTotal,
      },
    });
  }

  const populated = await Quotation.findById(quotation._id).populate(QUOTATION_POPULATE).lean();
  if (status === 'pending_approval') {
    notifyQuotationCreated(populated, lead, {
      approverIds: teamLeaderId ? [teamLeaderId] : [],
    }).catch(() => {});
  }

  return populated;
}

function assertCanCreateQuotation(req) {
  if (req.user.role === 'admin') {
    throw new ApiError(403, 'Admin can only view quotations');
  }
}

module.exports = { persistQuotation, assertCanCreateQuotation };
