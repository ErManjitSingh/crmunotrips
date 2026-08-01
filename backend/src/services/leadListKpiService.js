const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const { withBranch } = require('../utils/branchScope');
const { getOrSet, cacheKey } = require('./dashboardCacheService');

const LIST_KPI_TTL_MS = 60 * 1000;

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
 * Slim KPIs for Lead Management strip — one $facet + follow-up / duplicate counts.
 */
async function buildLeadListKpis(branchId) {
  const match = withBranch({ isDeleted: { $ne: true } }, branchId);
  const { start, end } = todayRange();

  const [[row], followUpPending, duplicateLeads] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      {
        $facet: {
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
        },
      },
    ]),
    FollowUp.countDocuments(withBranch({ status: 'pending' }, branchId)),
    countDuplicateLeads(branchId),
  ]);

  const n = (key) => row?.[key]?.[0]?.n ?? 0;

  return {
    todayLeads: n('today'),
    newLeads: n('statusNew'),
    unassignedLeads: n('unassigned'),
    assignedLeads: n('assigned'),
    followUpPending,
    lostLeads: n('lost'),
    convertedLeads: n('converted'),
    duplicateLeads,
  };
}

async function getLeadListKpis(branchId) {
  const key = cacheKey('lead-list-kpis', branchId || 'global');
  return getOrSet(key, () => buildLeadListKpis(branchId), LIST_KPI_TTL_MS);
}

module.exports = {
  buildLeadListKpis,
  getLeadListKpis,
  findDuplicateLeadIds,
  countDuplicateLeads,
  LIST_KPI_TTL_MS,
};
