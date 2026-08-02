/**
 * Dual costing helpers for quotation approval (Costing 1 = exec, Costing 2 = approver).
 */

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function baseFromPricing(pricing = {}, costing = {}) {
  const fromParts =
    toNum(pricing.baseCost) +
    toNum(pricing.hotelCost) +
    toNum(pricing.cabCost) +
    toNum(pricing.flightCost) +
    toNum(pricing.activityCost);
  if (fromParts > 0) return fromParts;
  const grand = toNum(pricing.total || costing.grandTotal);
  const adminPct = toNum(pricing.adminMarginPercent || costing.adminMarginPercent);
  const markupPct = toNum(pricing.markupPercent || costing.markupPercent);
  if (grand > 0 && (adminPct > 0 || markupPct > 0)) {
    let base = grand;
    if (markupPct > 0) base = base / (1 + markupPct / 100);
    if (adminPct > 0) base = base / (1 + adminPct / 100);
    return Math.round(base * 100) / 100;
  }
  return Math.max(0, grand - toNum(pricing.markup || costing.markup));
}

function snapshotCosting1(quotation) {
  const pricing = quotation.pricing || {};
  const costing = quotation.costing || {};
  const baseCost = baseFromPricing(pricing, costing);
  return {
    label: 'Costing 1',
    baseCost,
    markupPercent: toNum(pricing.markupPercent || costing.markupPercent),
    adminMarginPercent: toNum(pricing.adminMarginPercent || costing.adminMarginPercent),
    profitMargin: toNum(pricing.profitMargin || costing.profitMargin),
    taxes: toNum(pricing.taxes || costing.taxes),
    discount: toNum(pricing.discount || costing.discount),
    grandTotal: toNum(pricing.total || costing.grandTotal),
    gstEnabled: Boolean(pricing.gstEnabled || costing.gstEnabled),
    capturedAt: new Date(),
  };
}

function buildCosting2({ quotation, markupPercent, actor }) {
  const c1 = quotation.costing1 || snapshotCosting1(quotation);
  const baseCost = toNum(c1.baseCost);
  const adminPct = Math.max(0, toNum(c1.adminMarginPercent || quotation.pricing?.adminMarginPercent));
  const pct = Math.max(0, toNum(markupPercent));
  const disc = toNum(c1.discount);

  // Same as calculatePricing: admin once on costs → exec on after-admin → discount → GST
  const adminMarkup =
    adminPct > 0 ? Math.round(baseCost * (adminPct / 100) * 100) / 100 : 0;
  const afterAdmin = baseCost + adminMarkup;
  const execMarkup = pct > 0 ? Math.round(afterAdmin * (pct / 100) * 100) / 100 : 0;
  const markup = adminMarkup + execMarkup;
  const packageCost = Math.max(0, afterAdmin + execMarkup - disc);
  const taxes = c1.gstEnabled ? Math.round(packageCost * 0.05 * 100) / 100 : toNum(c1.taxes);
  const grandTotal = Math.max(0, packageCost + taxes);
  const profitMargin = grandTotal > 0 ? Math.round(((markup - disc) / grandTotal) * 1000) / 10 : 0;

  return {
    label: 'Costing 2',
    baseCost,
    markupPercent: pct,
    adminMarginPercent: adminPct,
    markup,
    adminMarkup,
    execMarkup,
    profitMargin,
    taxes,
    discount: disc,
    grandTotal,
    gstEnabled: Boolean(c1.gstEnabled),
    setBy: actor?._id,
    setByName: actor?.name || '',
    setByRole: actor?.role || '',
    setAt: new Date(),
  };
}

function applyCosting2ToQuotation(quotation, costing2) {
  quotation.costing2 = costing2;
  quotation.pricing = quotation.pricing || {};
  quotation.pricing.markupPercent = costing2.markupPercent;
  quotation.pricing.adminMarginPercent = costing2.adminMarginPercent;
  quotation.pricing.markup = costing2.markup;
  quotation.pricing.taxes = costing2.taxes;
  quotation.pricing.total = costing2.grandTotal;
  quotation.pricing.profitMargin = costing2.profitMargin;
  quotation.costing = quotation.costing || {};
  quotation.costing.markupPercent = costing2.markupPercent;
  quotation.costing.adminMarginPercent = costing2.adminMarginPercent;
  quotation.costing.markup = costing2.markup;
  quotation.costing.taxes = costing2.taxes;
  quotation.costing.grandTotal = costing2.grandTotal;
  quotation.costing.profitMargin = costing2.profitMargin;
  quotation.costing.discount = costing2.discount;
  quotation.costing.gstEnabled = costing2.gstEnabled;
}

function buildQuotePackageSummary(quotation) {
  const snap = quotation.packageSnapshot || {};
  const hotels = quotation.selectedHotels || [];
  const cabs = quotation.selectedCabs || [];
  const activities = quotation.selectedActivities || [];
  const days = snap.duration || snap.days || snap.itinerary?.length || null;
  return {
    packageName: snap.name || quotation.package?.name || 'Custom package',
    destination: snap.destination || quotation.lead?.destination || '',
    duration: days,
    hotelsCount: hotels.length,
    hotelNames: hotels.slice(0, 4).map((h) => h.name || h.snapshot?.name).filter(Boolean),
    cabsCount: cabs.length,
    activitiesCount: activities.length,
    inclusions: snap.inclusions || snap.includes || '',
    exclusions: snap.exclusions || snap.excludes || '',
    customizations: quotation.customizations || '',
  };
}

module.exports = {
  snapshotCosting1,
  buildCosting2,
  applyCosting2ToQuotation,
  buildQuotePackageSummary,
  baseFromPricing,
};
