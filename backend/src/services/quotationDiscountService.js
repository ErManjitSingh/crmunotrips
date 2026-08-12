/**
 * ASK-for-discount helpers: auto 5% + optional extra (manager approval).
 */

const AUTO_ASK_DISCOUNT_PERCENT = 5;

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function hasExtraDiscountRequest(pricing = {}) {
  return Boolean(pricing?.askDiscount) && toNum(pricing.extraDiscount) > 0;
}

function packageBeforeDiscount(pricing = {}) {
  const costs =
    toNum(pricing.hotelCost) +
    toNum(pricing.cabCost) +
    toNum(pricing.flightCost) +
    toNum(pricing.activityCost);
  const adminPct = pricing.companyMarginBaked ? 0 : toNum(pricing.adminMarginPercent);
  const afterAdmin = costs + (adminPct > 0 ? round2(costs * (adminPct / 100)) : 0);
  const execPct = toNum(pricing.markupPercent);
  const execMarkup =
    execPct > 0 ? round2(afterAdmin * (execPct / 100)) : toNum(pricing.markup);
  return afterAdmin + execMarkup;
}

function getAutoAskDiscountAmount(pricing = {}) {
  if (!pricing?.askDiscount) return 0;
  return round2(packageBeforeDiscount(pricing) * (AUTO_ASK_DISCOUNT_PERCENT / 100));
}

/** Recompute total discount = auto 5% + extra ₹ (when askDiscount is on). */
function normalizeAskDiscountPricing(pricing = {}) {
  if (!pricing || typeof pricing !== 'object') return pricing;
  if (!pricing.askDiscount) {
    return {
      ...pricing,
      autoDiscountAmount: 0,
      extraDiscount: 0,
      extraDiscountPending: false,
    };
  }
  const autoAmount = getAutoAskDiscountAmount(pricing);
  const extraAmount = toNum(pricing.extraDiscount);
  return {
    ...pricing,
    autoDiscountAmount: autoAmount,
    extraDiscount: extraAmount,
    discount: round2(autoAmount + extraAmount),
    extraDiscountPending: extraAmount > 0,
  };
}

function discountPercentOf(totalDiscount, before) {
  if (before <= 0 || totalDiscount <= 0) return 0;
  return Math.round((totalDiscount / before) * 1000) / 10;
}

function buildDiscountHistoryOnSubmit({ pricing, actor, quoteStatus }) {
  const p = normalizeAskDiscountPricing(pricing || {});
  const before = packageBeforeDiscount(p);
  const entries = [];
  const now = new Date();
  const by = actor?.name || 'Executive';
  const byUserId = actor?._id || undefined;

  if (!p.askDiscount) return entries;

  const autoAmount = toNum(p.autoDiscountAmount) || getAutoAskDiscountAmount(p);
  entries.push({
    type: 'auto_5',
    autoAmount,
    extraAmount: 0,
    totalAmount: autoAmount,
    percent: AUTO_ASK_DISCOUNT_PERCENT,
    status: 'applied',
    note: 'Auto 5% ASK discount applied',
    by,
    byUserId,
    at: now,
  });

  const extraAmount = toNum(p.extraDiscount);
  if (extraAmount > 0) {
    const totalAmount = round2(autoAmount + extraAmount);
    entries.push({
      type: 'extra_request',
      autoAmount,
      extraAmount,
      totalAmount,
      percent: discountPercentOf(totalAmount, before),
      status: quoteStatus === 'pending_approval' ? 'pending' : 'applied',
      note: `Extra discount ₹${extraAmount.toLocaleString('en-IN')} requested (total ${discountPercentOf(totalAmount, before)}% off)`,
      by,
      byUserId,
      at: now,
    });
  }

  return entries;
}

function appendDiscountHistory(quotation, entries = []) {
  if (!entries.length) return;
  quotation.discountHistory = Array.isArray(quotation.discountHistory)
    ? quotation.discountHistory
    : [];
  quotation.discountHistory.push(...entries);
}

function resolvePendingDiscountEntries(quotation, { status, actor, note }) {
  const history = Array.isArray(quotation.discountHistory) ? quotation.discountHistory : [];
  const now = new Date();
  let changed = false;
  for (const entry of history) {
    if (entry && entry.type === 'extra_request' && entry.status === 'pending') {
      entry.status = status;
      changed = true;
    }
  }
  if (changed || hasExtraDiscountRequest(quotation.pricing)) {
    history.push({
      type: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'changes_requested',
      autoAmount: toNum(quotation.pricing?.autoDiscountAmount),
      extraAmount: toNum(quotation.pricing?.extraDiscount),
      totalAmount: toNum(quotation.pricing?.discount),
      percent: discountPercentOf(
        toNum(quotation.pricing?.discount),
        packageBeforeDiscount(quotation.pricing || {})
      ),
      status,
      note:
        note ||
        (status === 'approved'
          ? 'Extra discount approved by manager'
          : status === 'rejected'
            ? 'Extra discount rejected'
            : 'Changes requested on discount quote'),
      by: actor?.name || 'Approver',
      byUserId: actor?._id || undefined,
      at: now,
    });
  }
  quotation.discountHistory = history;
  if (quotation.pricing) {
    quotation.pricing.extraDiscountPending = status === 'approved' ? false : Boolean(quotation.pricing.extraDiscountPending);
    if (status === 'approved') quotation.pricing.extraDiscountPending = false;
  }
}

module.exports = {
  AUTO_ASK_DISCOUNT_PERCENT,
  hasExtraDiscountRequest,
  normalizeAskDiscountPricing,
  getAutoAskDiscountAmount,
  buildDiscountHistoryOnSubmit,
  appendDiscountHistory,
  resolvePendingDiscountEntries,
};
