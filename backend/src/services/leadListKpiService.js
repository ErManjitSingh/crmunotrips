const Lead = require('../models/Lead');
const { withBranch } = require('../utils/branchScope');
const { getOrSet, cacheKey } = require('./dashboardCacheService');

const LIST_KPI_TTL_MS = 60 * 1000;

/**
 * Slim KPIs for Lead Management strip — one $facet instead of full admin dashboard.
 */
async function buildLeadListKpis(branchId) {
  const match = withBranch({ isDeleted: { $ne: true } }, branchId);
  const [row] = await Lead.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalLeads: { $sum: 1 },
              totalBudget: { $sum: { $ifNull: ['$budget', 0] } },
              convertedLeads: {
                $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
              },
            },
          },
        ],
      },
    },
  ]);

  const totals = row?.totals?.[0] || {};
  const totalLeads = totals.totalLeads || 0;
  const convertedLeads = totals.convertedLeads || 0;
  const totalBudget = totals.totalBudget || 0;
  const conversionRate = totalLeads
    ? Math.round((convertedLeads / totalLeads) * 1000) / 10
    : 0;

  return {
    totalLeads,
    totalBudget,
    convertedLeads,
    conversionRate,
  };
}

async function getLeadListKpis(branchId) {
  const key = cacheKey('lead-list-kpis', branchId || 'global');
  return getOrSet(key, () => buildLeadListKpis(branchId), LIST_KPI_TTL_MS);
}

module.exports = {
  buildLeadListKpis,
  getLeadListKpis,
  LIST_KPI_TTL_MS,
};
