/**
 * Lead-list temperature buckets (Cold / Warm / Hot / Lost lead).
 * Mirrors frontend/src/lib/executiveStatusDisplay.js — list display only.
 */

const COLD_KEYS = [
  'not_interested',
  'invalid_number',
  'switch_off',
  'switched_off',
  'not_reachable',
  'not_answer',
  'no_answer',
  'not_answering',
  'no_plan',
  'just_inquiring',
  'just_inquiry',
  'language_barrier',
  'wants_group_tour',
  'unknown_destination',
  'speaking_to_someone_else',
  'call_not_picked',
  'not_pick_call',
  'not_picked',
];

const WARM_KEYS = [
  'discussed_package',
  'budget_issues',
  'budget_issue',
  'qualified',
  'working_progress',
  'requested_callback',
  'rescheduled',
];

const HOT_KEYS = [
  'interested_quotation',
  'price_negotiation',
  'ready_to_book',
  'interested',
];

const LOST_KEYS = [
  'lost_contacted',
  'booked_elsewhere',
  'does_not_exist',
  'quotation_booked_elsewhere',
  'booked_from_another_company',
  'lost',
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

function lostClause() {
  return {
    $or: [
      { status: { $in: ['lost', 'booked_from_another_company'] } },
      reasonClause(LOST_KEYS),
    ],
  };
}

function hotClause() {
  return {
    $and: [
      { $nor: [lostClause()] },
      { status: { $ne: 'converted' } },
      {
        $or: [
          reasonClause(HOT_KEYS),
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
      { $nor: [lostClause(), hotClause()] },
      { status: { $nin: ['converted', 'new'] } },
      {
        $or: [
          reasonClause(WARM_KEYS),
          { status: { $in: ['qualified', 'working_progress'] } },
          {
            status: { $in: ['follow_up', 'contacted', 'reactivated'] },
            $nor: [reasonClause(COLD_KEYS), reasonClause(HOT_KEYS), reasonClause(LOST_KEYS)],
          },
        ],
      },
    ],
  };
}

function coldClause() {
  return {
    $and: [
      { $nor: [lostClause(), hotClause(), warmClause()] },
      { status: { $nin: ['converted'] } },
      {
        $or: [
          reasonClause(COLD_KEYS),
          {
            status: { $nin: ['new'] },
            $nor: [reasonClause(HOT_KEYS), reasonClause(WARM_KEYS), reasonClause(LOST_KEYS)],
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
  lost: lostClause,
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
