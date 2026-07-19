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

function buildFollowUpListFilter(query = {}) {
  const { status, tab, kpiTab, leadId, category, search, priority } = query;

  const filter = {
    ...buildFollowUpTabFilter(tab || kpiTab),
    ...buildFollowUpCategoryFilter(category),
  };

  if (status) filter.status = status;
  if (leadId) filter.lead = leadId;
  if (priority) filter.priority = priority;

  if (search?.trim() && !leadId) {
    filter._leadSearch = search.trim();
  }

  return filter;
}

async function findFollowUpsPaginated(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 200 });
  const sort = parseSort(query, { scheduledAt: 1 });
  const filter = buildFollowUpListFilter(query);

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
