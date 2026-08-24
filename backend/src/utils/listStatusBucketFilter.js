/**
 * Lead-list temperature buckets (Cold / Warm / Hot).
 * Mirrors frontend/src/lib/executiveStatusDisplay.js — list display only.
 */

const COLD_KEYS = [
  'booked_elsewhere',
  'booked_from_another_company',
  'language_barrier',
  'not_interested',
  'invalid_number',
  'budget_issues',
  'budget_issue',
  // legacy → Cold
  'just_inquiring',
  'just_inquiry',
  'no_plan',
  'wants_group_tour',
  'unknown_destination',
  'switch_off',
  'switched_off',
  'not_reachable',
  'not_answer',
  'no_answer',
  'not_answering',
  'speaking_to_someone_else',
  'call_not_picked',
  'not_pick_call',
  'not_picked',
  'lost',
  'lost_contacted',
  'does_not_exist',
  'quotation_booked_elsewhere',
];

const WARM_KEYS = [
  'discussed_package',
  'requested_callback',
  'cnp_same_day',
  'price_negotiation',
  'qualified',
  'working_progress',
  'rescheduled',
];

const HOT_KEYS = [
  'ready_to_book',
  'interested_quotation',
  'interested',
];

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reasonClause(keys) {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const alts = sorted.map(escapeRegex).join('|');
  const pattern = `(^|not_connected:)(${alts})($|[\\s:.—–-])`;
  return {
    $or: [
      { statusReason: { $regex: pattern, $options: 'i' } },
    ],
  };
}

function hotClause() {
  return {
    $and: [
      { status: { $ne: 'converted' } },
      {
        $or: [
          reasonClause(HOT_KEYS),
          { temperature: 'hot' },
          { isHot: true },
          { status: 'negotiation' },
          {
            status: 'quotation_sent',
            $nor: [reasonClause(COLD_KEYS), reasonClause(WARM_KEYS)],
          },
        ],
      },
    ],
  };
}

function warmClause() {
  return {
    $and: [
      { $nor: [hotClause()] },
      { status: { $nin: ['converted', 'new'] } },
      {
        $or: [
          reasonClause(WARM_KEYS),
          { temperature: 'warm' },
          { status: { $in: ['qualified', 'working_progress'] } },
          {
            status: { $in: ['follow_up', 'contacted', 'reactivated'] },
            $nor: [reasonClause(COLD_KEYS), reasonClause(HOT_KEYS)],
          },
        ],
      },
    ],
  };
}

function coldClause() {
  return {
    $and: [
      { $nor: [hotClause(), warmClause()] },
      { status: { $nin: ['converted'] } },
      {
        $or: [
          reasonClause(COLD_KEYS),
          { temperature: 'cold' },
          { status: { $in: ['lost', 'booked_from_another_company'] } },
          {
            status: { $nin: ['new'] },
            $nor: [reasonClause(HOT_KEYS), reasonClause(WARM_KEYS)],
          },
        ],
      },
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
