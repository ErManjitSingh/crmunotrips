/**
 * Lead-list Warm / Hot / Cold filters.
 * Only matches leads that have a current status option selected (statusReason).
 * Mirrors frontend/src/lib/executiveStatusDisplay.js
 */

const COLD_KEYS = [
  'booked_elsewhere',
  'language_barrier',
  'not_interested',
  'invalid_number',
  'budget_issues',
  'budget_issue',
];

const WARM_KEYS = [
  'discussed_package',
  'requested_callback',
  'cnp_same_day',
  'price_negotiation',
];

const HOT_KEYS = [
  'ready_to_book',
];

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reasonClause(keys) {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const alts = sorted.map(escapeRegex).join('|');
  const pattern = `(^|not_connected:)(${alts})($|[\\s:.—–-])`;
  return {
    statusReason: { $regex: pattern, $options: 'i' },
  };
}

function hotClause() {
  return {
    $and: [
      { status: { $ne: 'converted' } },
      reasonClause(HOT_KEYS),
    ],
  };
}

function warmClause() {
  return {
    $and: [
      { status: { $ne: 'converted' } },
      reasonClause(WARM_KEYS),
    ],
  };
}

function coldClause() {
  return {
    $and: [
      { status: { $ne: 'converted' } },
      reasonClause(COLD_KEYS),
    ],
  };
}

const CLAUSES = {
  cold: coldClause,
  warm: warmClause,
  hot: hotClause,
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
