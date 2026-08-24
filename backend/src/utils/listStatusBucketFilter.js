/**
 * Lead-list Warm / Hot / Cold filters.
 * Only matches leads that have a current status option selected (statusReason).
 * Keys come from admin Lead Status Control (with static fallback).
 */

const FALLBACK = {
  cold: [
    'booked_elsewhere',
    'language_barrier',
    'not_interested',
    'invalid_number',
    'budget_issues',
    'budget_issue',
  ],
  warm: [
    'discussed_package',
    'requested_callback',
    'cnp_same_day',
    'price_negotiation',
  ],
  hot: ['ready_to_book'],
};

function resolveKeys(bucket) {
  try {
    const { getCachedKeysByCategory } = require('../services/leadStatusConfigService');
    const keys = getCachedKeysByCategory();
    const list = keys[bucket] || [];
    return list.length ? list : FALLBACK[bucket] || [];
  } catch {
    return FALLBACK[bucket] || [];
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reasonClause(keys) {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const alts = sorted.map(escapeRegex).join('|');
  if (!alts) return { statusReason: { $exists: false } };
  const pattern = `(^|not_connected:)(${alts})($|[\\s:.—–-])`;
  return {
    statusReason: { $regex: pattern, $options: 'i' },
  };
}

function bucketClause(bucket) {
  return {
    $and: [
      { status: { $ne: 'converted' } },
      reasonClause(resolveKeys(bucket)),
    ],
  };
}

const CLAUSES = {
  cold: () => bucketClause('cold'),
  warm: () => bucketClause('warm'),
  hot: () => bucketClause('hot'),
};

function applyListStatusBucket(mongoFilter, listStatus) {
  const key = String(listStatus || '').toLowerCase();
  const builder = CLAUSES[key];
  if (!builder) return mongoFilter;
  if (!mongoFilter.$and) mongoFilter.$and = [];
  mongoFilter.$and.push(builder());
  delete mongoFilter.status;
  return mongoFilter;
}

module.exports = { applyListStatusBucket };
