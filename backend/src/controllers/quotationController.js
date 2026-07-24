const Quotation = require('../models/Quotation');
const Lead = require('../models/Lead');
const Package = require('../models/Package');
const { resolvePackageReference } = require('../utils/packageRef');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyQuotationCreated } = require('../services/notificationService');
const { QUOTATION_POPULATE, generateQuoteNumber } = require('../utils/queryHelpers');
const { findQuotationsPaginated } = require('../repositories/quotationRepository');
const { getQuotationStats } = require('../repositories/roleScopedRepository');
const { calculateQuotationPricing } = require('../services/quotationCostingService');

function buildComputedPricingPayload({ body, packageSnapshot }) {
  const computed = calculateQuotationPricing({
    packageSnapshot: packageSnapshot || body.package || null,
    selectedHotels: body.selectedHotels || [],
    selectedCabs: body.selectedCabs || [],
    selectedFlights: body.selectedFlights || [],
    selectedActivities: body.selectedActivities || [],
    pricingInput: body.pricing || {},
  });

  return {
    pricing: computed.pricing,
    costing: computed.costing,
    selectedHotels: body.selectedHotels || [],
    selectedCabs: body.selectedCabs || [],
    selectedFlights: body.selectedFlights || [],
    selectedActivities: body.selectedActivities || [],
  };
}

const listQuotations = asyncHandler(async (req, res) => {
  const result = await findQuotationsPaginated(req.query, { branchId: req.branchId });
  res.json(result);
});

const getQuotationStatsHandler = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const stats = await getQuotationStats(filter);
  res.json(stats);
});

const getQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id).populate(QUOTATION_POPULATE).lean();
  if (!quotation) throw new ApiError(404, 'Quotation not found');
  res.json(quotation);
});

const createQuotation = asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    throw new ApiError(403, 'Admin can only view quotations');
  }

  const lead = await Lead.findById(req.body.leadId || req.body.lead);
  if (!lead) throw new ApiError(404, 'Lead not found');

  const status = req.body.status || 'draft';
  if (status !== 'draft') {
    const { assertQualifiedForQuotation } = require('../services/salesSopService');
    assertQualifiedForQuotation(lead);
  }
  let pkg = null;
  if (req.body.packageId) {
    pkg = await Package.findById(req.body.packageId).lean();
  }

  const computedPayload = buildComputedPricingPayload({
    body: req.body,
    packageSnapshot: pkg || req.body.package,
  });

  const quotation = await Quotation.create({
    quoteNumber: req.body.quoteNumber || generateQuoteNumber(),
    branchId: req.branchId || lead.branchId,
    lead: lead._id,
    package: resolvePackageReference(req.body.packageId),
    packageSnapshot: pkg || req.body.package,
    status: status,
    pricing: computedPayload.pricing,
    costing: computedPayload.costing,
    selectedHotels: computedPayload.selectedHotels,
    selectedCabs: computedPayload.selectedCabs,
    selectedFlights: computedPayload.selectedFlights,
    selectedActivities: computedPayload.selectedActivities,
    customizations: req.body.customizations,
    createdByExecutive: req.body.createdByExecutive,
    teamLeader: req.body.teamLeader,
    timeline: req.body.timeline || [
      { type: 'created', date: new Date(), user: req.user.name, notes: 'Quote created' },
    ],
    createdBy: req.user._id,
  });

  const populated = await Quotation.findById(quotation._id).populate(QUOTATION_POPULATE).lean();
  if (populated.status === 'pending_approval' || populated.status === 'sent') {
    notifyQuotationCreated(populated, lead).catch(() => {});
  }
  res.status(201).json(populated);
});

const updateQuotation = asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    throw new ApiError(403, 'Admin can only view quotations');
  }

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  const packageSnapshot = req.body.package || quotation.packageSnapshot;
  const computedPayload = buildComputedPricingPayload({
    body: {
      ...quotation.toObject(),
      ...req.body,
    },
    packageSnapshot,
  });

  Object.assign(quotation, req.body, computedPayload);
  await quotation.save();

  const populated = await Quotation.findById(quotation._id).populate(QUOTATION_POPULATE).lean();
  res.json(populated);
});

const deleteQuotation = asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    throw new ApiError(403, 'Admin can only view quotations');
  }

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw new ApiError(404, 'Quotation not found');
  await quotation.deleteOne();
  res.json({ message: 'Quotation deleted' });
});

const duplicateQuotation = asyncHandler(async (req, res) => {
  const original = await Quotation.findById(req.params.id).lean();
  if (!original) throw new ApiError(404, 'Quotation not found');

  const { _id, quoteNumber, createdAt, updatedAt, approvedBy, sentAt, ...rest } = original;
  const copy = await Quotation.create({
    ...rest,
    quoteNumber: generateQuoteNumber(),
    status: 'draft',
    timeline: [
      ...(original.timeline || []),
      { type: 'duplicated', date: new Date(), user: req.user.name, notes: `Duplicated from ${original.quoteNumber}` },
    ],
    createdBy: req.user._id,
  });

  const populated = await Quotation.findById(copy._id).populate(QUOTATION_POPULATE).lean();
  res.status(201).json(populated);
});

const recalculateQuotation = asyncHandler(async (req, res) => {
  const computed = calculateQuotationPricing({
    packageSnapshot: req.body.package || null,
    selectedHotels: req.body.selectedHotels || [],
    selectedCabs: req.body.selectedCabs || [],
    selectedFlights: req.body.selectedFlights || [],
    selectedActivities: req.body.selectedActivities || [],
    pricingInput: req.body.pricing || {},
  });
  res.json(computed);
});

module.exports = {
  listQuotations,
  getQuotationStatsHandler,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  duplicateQuotation,
  recalculateQuotation,
};
