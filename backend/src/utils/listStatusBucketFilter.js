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

/** Shared pattern builder — the one place the "does this statusReason belong to this bucket's
 * key list" rule is defined. Both the query-side clause below and bucketForLead() (used by the
 * status-movement tracker) go through this, so there is only ever one Warm/Hot/Cold definition. */
function reasonPattern(keys) {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const alts = sorted.map(escapeRegex).join('|');
  if (!alts) return null;
  return new RegExp(`(^|not_connected:)(${alts})($|[\\s:.—–-])`, 'i');
}

function reasonClause(keys) {
  const pattern = reasonPattern(keys);
  if (!pattern) return { statusReason: { $exists: false } };
  return {
    statusReason: { $regex: pattern.source, $options: 'i' },
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

/**
 * `statusReason`, when given, narrows a bucket down to one specific sub-status key (e.g. the
 * Admin "Lead Status" nested filter's Hot -> "Ready to Book" click) using the exact same
 * matching pattern as the bucket-level clause above, just against a single-key list instead of
 * the whole category. Takes precedence over `listStatus` so the two never fight.
 */
function applyListStatusBucket(mongoFilter, listStatus, statusReason) {
  if (statusReason) {
    if (!mongoFilter.$and) mongoFilter.$and = [];
    mongoFilter.$and.push({
      $and: [{ status: { $ne: 'converted' } }, reasonClause([statusReason])],
    });
    delete mongoFilter.status;
    return mongoFilter;
  }

  const key = String(listStatus || '').toLowerCase();
  const builder = CLAUSES[key];
  if (!builder) return mongoFilter;
  if (!mongoFilter.$and) mongoFilter.$and = [];
  mongoFilter.$and.push(builder());
  delete mongoFilter.status;
  return mongoFilter;
}

const BUCKETS = ['cold', 'warm', 'hot'];

/**
 * The SAME Cold/Warm/Hot bucket definition as the query-side filter above (resolveKeys +
 * reasonPattern), evaluated in-process for one lead's status/statusReason at a point in time.
 * Used only by the status-movement tracker to know which bucket a lead was in immediately
 * before/after a status change — this is not a second definition of Warm/Hot/Cold, it reuses the
 * exact same key lists and matching pattern as the existing "Lead Status" filter.
 * Returns null when the lead has no current bucket (converted, or statusReason doesn't match any
 * configured key) — a null bucket never participates in a recorded movement.
 */
function bucketForLead(status, statusReason) {
  if (status === 'converted') return null;
  if (!statusReason) return null;
  for (const bucket of BUCKETS) {
    const pattern = reasonPattern(resolveKeys(bucket));
    if (pattern && pattern.test(String(statusReason))) return bucket;
  }
  return null;
}

module.exports = { applyListStatusBucket, bucketForLead, BUCKETS };
