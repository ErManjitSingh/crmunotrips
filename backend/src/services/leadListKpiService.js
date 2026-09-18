const crypto = require('crypto');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const { withBranch } = require('../utils/branchScope');
const { getOrSet, cacheKey } = require('./dashboardCacheService');

const LIST_KPI_TTL_MS = 30 * 1000;

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Last 10 digits of phone after stripping common separators */
function phoneKeyExpr(field = '$phone') {
  return {
    $let: {
      vars: {
        cleaned: {
          $replaceAll: {
            input: {
              $replaceAll: {
                input: {
                  $replaceAll: {
                    input: {
                      $replaceAll: {
                        input: {
                          $replaceAll: {
                            input: { $toString: { $ifNull: [field, ''] } },
                            find: ' ',
                            replacement: '',
                          },
                        },
                        find: '-',
                        replacement: '',
                      },
                    },
                    find: '+',
                    replacement: '',
                  },
                },
                find: '(',
                replacement: '',
              },
            },
            find: ')',
            replacement: '',
          },
        },
      },
      in: {
        $let: {
          vars: { len: { $strLenCP: '$$cleaned' } },
          in: {
            $cond: [
              { $gte: ['$$len', 10] },
              { $substrCP: ['$$cleaned', { $subtract: ['$$len', 10] }, 10] },
              '$$cleaned',
            ],
          },
        },
      },
    },
  };
}

async function countDuplicateLeads(branchId) {
  const match = withBranch(
    { isDeleted: { $ne: true }, phone: { $exists: true, $nin: [null, ''] } },
    branchId
  );
  const [row] = await Lead.aggregate([
    { $match: match },
    { $addFields: { phoneKey: phoneKeyExpr('$phone') } },
    { $match: { phoneKey: { $regex: '^[0-9]{10}$' } } },
    { $group: { _id: '$phoneKey', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $group: { _id: null, duplicateLeads: { $sum: '$n' } } },
  ]);
  return row?.duplicateLeads || 0;
}

/** Lead IDs that share a 10-digit phone with at least one other lead */
async function findDuplicateLeadIds(branchId) {
  const match = withBranch(
    { isDeleted: { $ne: true }, phone: { $exists: true, $nin: [null, ''] } },
    branchId
  );
  const groups = await Lead.aggregate([
    { $match: match },
    { $addFields: { phoneKey: phoneKeyExpr('$phone') } },
    { $match: { phoneKey: { $regex: '^[0-9]{10}$' } } },
    { $group: { _id: '$phoneKey', ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $project: { ids: 1 } },
  ]);
  return groups.flatMap((g) => g.ids || []);
}

/**
 * Slim KPIs for Lead Management strip — one $facet (over the SAME effective filter the Leads
 * List uses, see leadRepository.buildEffectiveLeadFilter) + follow-up count over just the
 * matching lead ids, so every card reflects exactly the currently filtered/paginated-independent
 * result set, never the whole collection.
 */
async function buildLeadListKpis(filter, branchId) {
  const { start, end } = todayRange();
  const duplicateIds = await findDuplicateLeadIds(branchId);

  const [row] = await Lead.aggregate([
    { $match: filter },
    {
      $facet: {
        total: [{ $count: 'n' }],
        today: [
          { $match: { createdAt: { $gte: start, $lte: end } } },
          { $count: 'n' },
        ],
        statusNew: [{ $match: { status: 'new' } }, { $count: 'n' }],
        unassigned: [{ $match: { assignedTo: null } }, { $count: 'n' }],
        assigned: [{ $match: { assignedTo: { $ne: null } } }, { $count: 'n' }],
        lost: [
          {
            $match: {
              status: { $in: ['lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        converted: [{ $match: { status: 'converted' } }, { $count: 'n' }],
        // Duplicate-phone leads that are ALSO within the current filter — the outer $match
        // above has already narrowed the document set this facet runs over.
        repeated: [{ $match: { _id: { $in: duplicateIds } } }, { $count: 'n' }],
        ids: [{ $project: { _id: 1 } }],
      },
    },
  ]);

  const n = (key) => row?.[key]?.[0]?.n ?? 0;
  const filteredLeadIds = (row?.ids || []).map((d) => d._id);
  const followUpPending = filteredLeadIds.length
    ? await FollowUp.countDocuments({ leadId: { $in: filteredLeadIds }, status: 'pending' })
    : 0;

  return {
    totalLeads: n('total'),
    todayLeads: n('today'),
    newLeads: n('today'),
    statusNewLeads: n('statusNew'),
    unassignedLeads: n('unassigned'),
    assignedLeads: n('assigned'),
    followUpPending,
    lostLeads: n('lost'),
    convertedLeads: n('converted'),
    duplicateLeads: n('repeated'),
  };
}

/**
 * `query` is the same Filters-panel query object `GET /leads` receives (period/date range,
 * source, destination, budget, executive, branch, team, state, priority, travel month,
 * listStatus/statusReason, search, ...). Cached per exact filter combination (short TTL) so
 * repeated identical requests (e.g. React Query refetch-on-focus) stay cheap without ever
 * serving a stale value for a *different* filter combination.
 */
async function getLeadListKpis(query = {}, branchId) {
  const { buildEffectiveLeadFilter } = require('../repositories/leadRepository');
  const filter = await buildEffectiveLeadFilter(query, { branchId });
  const queryFingerprint = crypto
    .createHash('sha1')
    .update(JSON.stringify(query))
    .digest('hex');
  const key = cacheKey('lead-list-kpis-v3', `${branchId || 'global'}:${queryFingerprint}`);
  return getOrSet(key, () => buildLeadListKpis(filter, branchId), LIST_KPI_TTL_MS);
}

/**
 * Slim KPIs for the Sales Manager "All Team Leads" strip (Total / New / Hot / Work in Progress /
 * Urgent) — same 5 counts `navCountsService.aggregateSalesManagerLeadCounts` already computes for
 * the sidebar badges, just over the SAME effective filter the Sales Manager Leads List uses (see
 * roleScopedRepository.buildEffectiveManagerLeadFilter) instead of the whole branch. "Urgent"
 * reuses the exact same stall-detection query as the sidebar badge, so its meaning is unchanged.
 */
async function buildManagerLeadListKpis(filter) {
  const { buildExecutiveStallQuery } = require('./leadExecutiveStallService');
  const stallMatch = buildExecutiveStallQuery();

  const [row] = await Lead.aggregate([
    { $match: filter },
    {
      $facet: {
        all: [{ $count: 'n' }],
        statusNew: [{ $match: { status: 'new' } }, { $count: 'n' }],
        hot: [
          {
            $match: {
              isHot: true,
              status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        workingProgress: [{ $match: { status: 'working_progress' } }, { $count: 'n' }],
        needsAttention: [{ $match: stallMatch }, { $count: 'n' }],
      },
    },
  ]);

  const n = (key) => row?.[key]?.[0]?.n ?? 0;

  return {
    all: n('all'),
    statusNew: n('statusNew'),
    hot: n('hot'),
    workingProgress: n('workingProgress'),
    needsAttention: n('needsAttention'),
  };
}

/**
 * `query` is the same Filters-panel query object `GET /sales-manager/leads` receives. Cached per
 * exact filter combination (short TTL), same pattern as getLeadListKpis above.
 */
async function getManagerLeadListKpis(query = {}, branchId) {
  const { buildEffectiveManagerLeadFilter } = require('../repositories/roleScopedRepository');
  const filter = await buildEffectiveManagerLeadFilter(query, { branchId });
  const queryFingerprint = crypto
    .createHash('sha1')
    .update(JSON.stringify(query))
    .digest('hex');
  const key = cacheKey('manager-lead-list-kpis-v1', `${branchId || 'global'}:${queryFingerprint}`);
  return getOrSet(key, () => buildManagerLeadListKpis(filter), LIST_KPI_TTL_MS);
}

module.exports = {
  buildLeadListKpis,
  getLeadListKpis,
  buildManagerLeadListKpis,
  getManagerLeadListKpis,
  findDuplicateLeadIds,
  countDuplicateLeads,
  LIST_KPI_TTL_MS,
};
