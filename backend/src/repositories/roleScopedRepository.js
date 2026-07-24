const Lead = require('../models/Lead');
const { LEAD_LIST_SELECT } = require('../utils/leadQueryFields');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const {
  LEAD_POPULATE,
  LEAD_LIST_POPULATE,
  FOLLOWUP_LIST_POPULATE,
  FOLLOWUP_LIST_SELECT,
  QUOTATION_LIST_POPULATE,
  QUOTATION_LIST_SELECT,
  enrichLead,
  buildLeadSearchFilter,
  buildFollowUpTabFilter,
  buildFollowUpCategoryFilter,
  startOfDay,
} = require('../utils/queryHelpers');
const {
  parsePagination,
  parseSort,
  paginatedResponse,
  DEEP_PAGE_THRESHOLD,
} = require('../utils/pagination');
const { withBranch } = require('../utils/branchScope');
const { applyQuotationQueryFilters } = require('./quotationRepository');

const LIST_PAGINATION = { defaultLimit: 20, maxLimit: 200 };

function withActiveLead(filter = {}) {
  return { ...filter, isDeleted: { $ne: true } };
}

function applyReactivationQueryFilters(mongoFilter, query = {}) {
  const stage = query.reactivationStage || query.stage;
  if (stage) mongoFilter['reactivation.stage'] = stage;
  if (query.status) mongoFilter.status = query.status;
  if (query.executiveId) mongoFilter.assignedTo = query.executiveId;
  const from = query.reactivatedFrom || query.from;
  const to = query.reactivatedTo || query.to;
  if (from || to) {
    mongoFilter['reactivation.reactivatedAt'] = {};
    if (from) mongoFilter['reactivation.reactivatedAt'].$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      mongoFilter['reactivation.reactivatedAt'].$lte = end;
    }
  }
}

function buildManagerLeadFilter(query = {}) {
  const { filter, search, status, destination, priority } = query;
  const mongoFilter = { ...buildLeadSearchFilter(search) };

  if (filter === 'unassigned') mongoFilter.assignedTo = null;
  else if (filter === 'assigned') mongoFilter.assignedTo = { $ne: null };
  else if (filter === 'lost') mongoFilter.status = { $in: ['lost', 'booked_from_another_company'] };
  else if (filter === 'reactivated') {
    mongoFilter['reactivation.isReactivated'] = true;
    applyReactivationQueryFilters(mongoFilter, query);
  } else if (filter === 'hot') {
    mongoFilter.isHot = true;
    mongoFilter.status = { $nin: ['lost', 'booked_from_another_company'] };
  } else if (!filter || filter === 'all') {
    if (status) mongoFilter.status = status;
    if (destination) mongoFilter.destination = destination;
    if (priority === 'hot') mongoFilter.isHot = true;
    else if (priority) mongoFilter.priority = priority;
  }

  return mongoFilter;
}

function buildExecutiveLeadFilter(filterKey) {
  if (filterKey === 'new') return { status: 'new' };
  if (filterKey === 'contacted') return { status: 'contacted' };
  if (filterKey === 'follow-up') return { status: { $in: ['follow_up', 'negotiation'] } };
  if (filterKey === 'converted') return { status: 'converted' };
  if (filterKey === 'lost') return { status: { $in: ['lost', 'booked_from_another_company'] } };
  if (filterKey === 'reactivated') {
    return {
      'reactivation.isReactivated': true,
      status: { $nin: ['lost', 'booked_from_another_company', 'converted'] },
    };
  }
  if (filterKey === 'hot') return { isHot: true };
  return {};
}

async function findManagerLeadsPaginated(query = {}, options = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, { createdAt: -1 });
  const filter = withActiveLead(withBranch(buildManagerLeadFilter(query), options.branchId));
  const needsTotal = page <= DEEP_PAGE_THRESHOLD;

  const [rows, total] = await Promise.all([
    Lead.find(filter)
      .select(LEAD_LIST_SELECT)
      .populate(LEAD_LIST_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    needsTotal ? Lead.countDocuments(filter) : Promise.resolve(null),
  ]);

  return paginatedResponse(rows.map(enrichLead), {
    page,
    limit,
    total,
    hasMore: rows.length === limit,
  });
}

async function findExecutiveLeadsPaginated(userId, query = {}, options = {}) {
  const filterKey = query.filter || query.paramsFilter;
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, { createdAt: -1 });

  // Release any of this exec's overdue accept windows before listing
  try {
    const { releaseExpiredLead } = require('../services/leadAcceptanceService');
    const overdue = await Lead.find({
      assignedTo: userId,
      assignmentAcceptance: 'pending',
      assignmentAcceptBy: { $lte: new Date() },
      isDeleted: { $ne: true },
    }).limit(20);
    for (const lead of overdue) {
      await releaseExpiredLead(lead);
    }
  } catch {
    /* non-blocking */
  }

  const filter = withActiveLead({
    assignedTo: userId,
    ...buildExecutiveLeadFilter(filterKey),
    ...buildLeadSearchFilter(query.search),
  });
  Object.assign(filter, withBranch({}, options.branchId));

  if (filterKey === 'hot') {
    filter.isHot = true;
    filter.status = { $nin: ['converted', 'lost', 'booked_from_another_company'] };
  }

  if (filterKey === 'all' || !filterKey) {
    if (query.status) filter.status = query.status;
    if (query.destination) filter.destination = query.destination;
    if (query.priority === 'hot') filter.isHot = true;
    else if (query.priority) filter.priority = query.priority;
  }

  const needsTotal = page <= DEEP_PAGE_THRESHOLD;
  const [rows, total] = await Promise.all([
    Lead.find(filter)
      .select(LEAD_LIST_SELECT)
      .populate(LEAD_LIST_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    needsTotal ? Lead.countDocuments(filter) : Promise.resolve(null),
  ]);

  let enriched = rows.map(enrichLead);
  if (filterKey === 'converted' || filter.status === 'converted') {
    const { attachPaymentSummariesToLeads } = require('../services/paymentReceiptService');
    enriched = await attachPaymentSummariesToLeads(enriched);
  }

  return paginatedResponse(enriched, {
    page,
    limit,
    total,
    hasMore: rows.length === limit,
  });
}

async function findTeamLeaderLeadsPaginated(squadFilter, query = {}, options = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, { createdAt: -1 });
  const extra = {};
  if (query.filter === 'reactivated') {
    extra['reactivation.isReactivated'] = true;
    applyReactivationQueryFilters(extra, query);
  }
  if (query.filter === 'lost') extra.status = { $in: ['lost', 'booked_from_another_company'] };
  if (query.filter === 'assigned') extra.assignedTo = { $ne: null };
  if (query.filter === 'unassigned') extra.assignedTo = null;
  if (query.filter === 'hot') {
    extra.$or = [{ isHot: true }, { leadScore: 'hot' }];
    extra.status = { $nin: ['converted', 'lost', 'booked_from_another_company'] };
  }
  if (!query.filter || query.filter === 'all') {
    if (query.status) extra.status = query.status;
    if (query.destination) extra.destination = query.destination;
    if (query.priority === 'hot') extra.isHot = true;
    else if (query.priority) extra.priority = query.priority;
  }
  const filter = withActiveLead(
    withBranch({ ...squadFilter, ...extra, ...buildLeadSearchFilter(query.search) }, options.branchId)
  );
  const needsTotal = page <= DEEP_PAGE_THRESHOLD;

  const [rows, total] = await Promise.all([
    Lead.find(filter)
      .select(LEAD_LIST_SELECT)
      .populate(LEAD_LIST_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    needsTotal ? Lead.countDocuments(filter) : Promise.resolve(null),
  ]);

  return paginatedResponse(rows.map(enrichLead), {
    page,
    limit,
    total,
    hasMore: rows.length === limit,
  });
}

async function resolveLeadIdsForSearch(search, options = {}) {
  if (!search?.trim()) return null;
  const leads = await Lead.find(withBranch(buildLeadSearchFilter(search), options.branchId))
    .select('_id')
    .limit(200)
    .lean();
  return leads.map((l) => l._id);
}

async function findScopedFollowUpsPaginated(baseFilter, query = {}, options = {}) {
  const { page, limit, skip } = parsePagination(query, LIST_PAGINATION);
  const sort = parseSort(query, { scheduledAt: 1 });

  const filter = {
    ...withBranch(baseFilter, options.branchId),
    ...buildFollowUpTabFilter(query.tab || query.kpiTab),
    ...buildFollowUpCategoryFilter(query.category),
  };

  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;

  const leadIds = await resolveLeadIdsForSearch(query.search, options);
  if (leadIds) filter.lead = { $in: leadIds };

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

async function findScopedQuotationsPaginated(baseFilter, query = {}, { mapRow, branchId } = {}) {
  const { page, limit, skip } = parsePagination(query, LIST_PAGINATION);
  const sort = parseSort(query, { createdAt: -1 });
  const filter = await applyQuotationQueryFilters(withBranch(baseFilter, branchId), query, branchId);

  const [rows, total] = await Promise.all([
    Quotation.find(filter)
      .select(QUOTATION_LIST_SELECT)
      .populate(QUOTATION_LIST_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Quotation.countDocuments(filter),
  ]);

  const data = mapRow ? rows.map(mapRow) : rows;
  return paginatedResponse(data, { page, limit, total });
}

async function getFollowUpSummary(baseFilter = {}, options = {}) {
  const scopedBase = withBranch(baseFilter, options.branchId);
  const todayStart = startOfDay();
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const [row] = await FollowUp.aggregate([
    { $match: scopedBase },
    {
      $facet: {
        total: [{ $count: 'n' }],
        today: [
          { $match: { scheduledAt: { $gte: todayStart, $lte: todayEnd } } },
          { $count: 'n' },
        ],
        missed: [
          {
            $match: {
              $or: [{ status: 'missed' }, { status: 'pending', scheduledAt: { $lt: todayStart } }],
            },
          },
          { $count: 'n' },
        ],
        upcoming: [
          { $match: { status: 'pending', scheduledAt: { $gt: todayEnd } } },
          { $count: 'n' },
        ],
        completed: [{ $match: { status: 'completed' } }, { $count: 'n' }],
      },
    },
  ]);

  const facet = row || {};
  const count = (key) => facet?.[key]?.[0]?.n ?? 0;

  return {
    total: count('total'),
    today: count('today'),
    missed: count('missed'),
    upcoming: count('upcoming'),
    completed: count('completed'),
  };
}

async function getQuotationStats(baseFilter = {}, options = {}) {
  const scopedBase = withBranch(baseFilter, options.branchId);
  const [total, sent, approved, pipelineAgg] = await Promise.all([
    Quotation.countDocuments(scopedBase),
    Quotation.countDocuments({ ...scopedBase, status: 'sent' }),
    Quotation.countDocuments({ ...scopedBase, status: 'approved' }),
    Quotation.aggregate([
      { $match: { ...scopedBase, status: { $in: ['sent', 'negotiation', 'pending_approval', 'draft'] } } },
      { $group: { _id: null, value: { $sum: { $ifNull: ['$pricing.total', 0] } } } },
    ]),
  ]);

  return {
    total,
    sent,
    approved,
    value: pipelineAgg[0]?.value || 0,
  };
}

module.exports = {
  findManagerLeadsPaginated,
  findExecutiveLeadsPaginated,
  findTeamLeaderLeadsPaginated,
  findScopedFollowUpsPaginated,
  findScopedQuotationsPaginated,
  getFollowUpSummary,
  getQuotationStats,
  buildExecutiveLeadFilter,
};
