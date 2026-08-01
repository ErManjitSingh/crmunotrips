const Quotation = require('../models/Quotation');

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Discount % of package before discount (costs + markup). */
function computeDiscountPercent(pricing = {}) {
  const discount = toNum(pricing.discount);
  if (discount <= 0) return 0;

  const costs =
    toNum(pricing.baseCost) +
    toNum(pricing.hotelCost) +
    toNum(pricing.cabCost) +
    toNum(pricing.flightCost) +
    toNum(pricing.activityCost);

  const pct = toNum(pricing.markupPercent);
  const markup =
    pct > 0 ? Math.round(costs * (pct / 100) * 100) / 100 : Math.max(0, toNum(pricing.markup));

  const packageBeforeDisc = costs + markup;
  if (packageBeforeDisc <= 0) return 0;
  return Math.round((discount / packageBeforeDisc) * 1000) / 10;
}

function buildDiscountSummary(quote) {
  if (!quote) return null;
  const pricing = quote.pricing || quote.costing1 || {};
  const discount = toNum(pricing.discount ?? quote.costing1?.discount);
  const discountPercent = computeDiscountPercent({
    ...pricing,
    discount,
  });
  return {
    _id: quote._id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    createdAt: quote.createdAt,
    total: toNum(pricing.total ?? quote.costing1?.grandTotal ?? quote.costing?.grandTotal),
    discount,
    discountPercent,
    profitMargin: toNum(pricing.profitMargin ?? quote.costing1?.profitMargin),
  };
}

/**
 * For each quote, attach previousQuotation summary (earlier non-draft on same lead)
 * so TL/SM can compare discount % on 2nd+ submissions.
 */
async function attachPreviousQuotationComparison(quotes = []) {
  if (!Array.isArray(quotes) || quotes.length === 0) return quotes;

  const leadIds = [
    ...new Set(
      quotes
        .map((q) => String(q.lead?._id || q.lead || ''))
        .filter(Boolean)
    ),
  ];
  if (!leadIds.length) return quotes;

  const siblings = await Quotation.find({
    lead: { $in: leadIds },
    status: { $ne: 'draft' },
  })
    .select('quoteNumber lead status pricing costing1 createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const byLead = new Map();
  for (const row of siblings) {
    const leadKey = String(row.lead);
    if (!byLead.has(leadKey)) byLead.set(leadKey, []);
    byLead.get(leadKey).push(row);
  }

  return quotes.map((q) => {
    const leadKey = String(q.lead?._id || q.lead || '');
    const list = byLead.get(leadKey) || [];
    const idx = list.findIndex((s) => String(s._id) === String(q._id));
    const previous = idx > 0 ? list[idx - 1] : null;
    const submissionIndex = idx >= 0 ? idx + 1 : list.length + 1;
    const currentDiscount = buildDiscountSummary(q);
    const previousDiscount = buildDiscountSummary(previous);

    return {
      ...q,
      submissionIndex,
      isRevisionSubmission: submissionIndex > 1,
      discountSummary: currentDiscount,
      previousQuotation: previousDiscount,
    };
  });
}

module.exports = {
  toNum,
  computeDiscountPercent,
  buildDiscountSummary,
  attachPreviousQuotationComparison,
};
