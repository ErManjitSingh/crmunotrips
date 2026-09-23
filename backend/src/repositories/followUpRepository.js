const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const {
  FOLLOWUP_LIST_POPULATE,
  FOLLOWUP_LIST_SELECT,
  buildFollowUpTabFilter,
  buildFollowUpCategoryFilter,
  buildLeadSearchFilter,
} = require('../utils/queryHelpers');
const { parsePagination, parseSort, paginatedResponse } = require('../utils/pagination');
const { withBranch } = require('../utils/branchScope');

function buildFollowUpListFilter(query = {}, branchId = null) {
  const { status, tab, kpiTab, leadId, category, search, priority } = query;

  const filter = withBranch(
    {
      ...buildFollowUpTabFilter(tab || kpiTab),
      ...buildFollowUpCategoryFilter(category),
    },
    branchId
  );

  if (status) filter.status = status;
  if (leadId) filter.lead = leadId;
  if (priority) filter.priority = priority;

  if (search?.trim() && !leadId) {
    filter._leadSearch = search.trim();
  }

  return filter;
}

async function findFollowUpsPaginated(query = {}, options = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 200 });
  // Missed follow-ups must show the newest (most recently overdue) scheduledAt first, applied
  // server-side before pagination so page 1 is genuinely the newest globally — not just the
  // generic oldest-first default used by the other tabs.
  const isMissedTab = (query.tab || query.kpiTab) === 'missed';
  const sort = parseSort(query, isMissedTab ? { scheduledAt: -1 } : { scheduledAt: 1 });
  const filter = buildFollowUpListFilter(query, options.branchId);

  if (filter._leadSearch) {
    const q = filter._leadSearch;
    delete filter._leadSearch;
    const leads = await Lead.find(buildLeadSearchFilter(q)).select('_id').limit(200).lean();
    filter.lead = { $in: leads.map((l) => l._id) };
  }

  const [rows, total] = await Promise.all([
    FollowUp.find(filter)
      .select(FOLLOWUP_LIST_SELECT)
      .populate(FOLLOWUP_LIST_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    FollowUp.countDocuments(filter),
  ]);

  return paginatedResponse(rows, { page, limit, total });
}

module.exports = {
  buildFollowUpListFilter,
  findFollowUpsPaginated,
};
