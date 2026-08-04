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
const {
  findPackageSharedLeadIds,
  wantsPackageSharedLeads,
} = require('../utils/packageSharedLeads');

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
    mongoFilter.status = { $nin: ['converted', 'lost', 'booked_from_another_company'] };
  } else if (filter === 'returned') {
    mongoFilter.assignedTo = null;
    mongoFilter.assignmentAcceptance = 'expired';
  } else if (!filter || filter === 'all') {
    if (status) mongoFilter.status = status;
    if (destination) mongoFilter.destination = destination;
    if (priority === 'hot') mongoFilter.isHot = true;
    else if (priority) mongoFilter.priority = priority;
  }

  return mongoFilter;
}

function buildExecutiveLeadFilter(filterKey) {
  if (filterKey === 'new') {
    // Today / Fresh leads — created or assigned today (not just status=new)
    const start = startOfDay();
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return {
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { assignedAt: { $gte: start, $lte: end } },
      ],
    };
  }
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
  if (filterKey === 'returned') {
    return {
      assignmentAcceptance: 'expired',
      assignedTo: null,
    };
  }
  return {};
}

async function findManagerLeadsPaginated(query = {}, options = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, { createdAt: -1 });
  const filter = withActiveLead(withBranch(buildManagerLeadFilter(query), options.branchId));

  if (wantsPackageSharedLeads(query)) {
    const ids = await findPackageSharedLeadIds({ branchId: options.branchId });
    filter._id = { $in: ids.length ? ids : [] };
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

  return paginatedResponse(rows.map(enrichLead), {
    page,
    limit,
    total,
    hasMore: rows.length === limit,
  });
}

function maskReturnedLeadForExecutive(lead, executiveId) {
  if (!lead || !executiveId) return lead;
  const missedBy = lead.acceptanceMissedBy?._id || lead.acceptanceMissedBy;
  const isReturned =
    lead.assignmentAcceptance === 'expired' &&
    String(missedBy) === String(executiveId) &&
    !lead.assignedTo;
  if (!isReturned) return lead;
  return {
    ...lead,
    phone: 'XXXX',
    alternatePhone: lead.alternatePhone ? 'XXXX' : '',
    whatsapp: lead.whatsapp ? 'XXXX' : '',
    email: lead.email ? 'xxxx@xxxx.com' : '',
    contactMasked: true,
    returnedToPool: true,
  };
}

async function findExecutiveLeadsPaginated(userId, query = {}, options = {}) {
  const filterKey = query.filter || query.paramsFilter;
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, { createdAt: -1 });

  // Expired acceptances are handled by notificationScheduler — not on every list request

  const searchPart = buildLeadSearchFilter(query.search);
  const statusExtras = buildExecutiveLeadFilter(filterKey);

  // Dedicated Returned Leads view — leads this exec did not accept in time
  if (filterKey === 'returned') {
    const returnedFilter = withActiveLead({
      acceptanceMissedBy: userId,
      ...statusExtras,
      ...searchPart,
    });
    Object.assign(returnedFilter, withBranch({}, options.branchId));
    const needsTotal = page <= DEEP_PAGE_THRESHOLD;
    const [rows, total] = await Promise.all([
      Lead.find(returnedFilter)
        .select(LEAD_LIST_SELECT)
        .populate(LEAD_LIST_POPULATE)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      needsTotal ? Lead.countDocuments(returnedFilter) : Promise.resolve(null),
    ]);
    const enriched = rows.map((row) => maskReturnedLeadForExecutive(enrichLead(row), userId));
    return paginatedResponse(enriched, {
      page,
      limit,
      total,
      hasMore: rows.length === limit,
    });
  }

  const owned = withActiveLead({
    assignedTo: userId,
  });
  // Avoid clobbering $or when Today filter + search both use it
  const andParts = [];
  if (statusExtras.$or) {
    andParts.push({ $or: statusExtras.$or });
  } else {
    Object.assign(owned, statusExtras);
  }
  if (searchPart.$or) {
    andParts.push({ $or: searchPart.$or });
  } else {
    Object.assign(owned, searchPart);
  }
  if (andParts.length) owned.$and = andParts;
  Object.assign(owned, withBranch({}, options.branchId));

  if (filterKey === 'hot') {
    owned.isHot = true;
    owned.status = { $nin: ['converted', 'lost', 'booked_from_another_company'] };
  }

  if (filterKey === 'all' || !filterKey || filterKey === 'package-shared' || filterKey === 'package_shared') {
    if (query.status) owned.status = query.status;
    if (query.destination) owned.destination = query.destination;
    if (query.state) owned.state = query.state;
    if (query.statusReason) {
      owned.statusReason = { $regex: String(query.statusReason).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    if (query.priority === 'hot') owned.isHot = true;
    else if (query.priority) owned.priority = query.priority;
  }

  if (wantsPackageSharedLeads(query)) {
    const sharedIds = await findPackageSharedLeadIds({ branchId: options.branchId });
    owned._id = { $in: sharedIds.length ? sharedIds : [] };
  }

  const filter = owned;

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

  let enriched = rows.map((row) => maskReturnedLeadForExecutive(enrichLead(row), userId));
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
  if (query.filter === 'returned') {
    extra.assignedTo = null;
    extra.assignmentAcceptance = 'expired';
    if (squadFilter?.assignedTo?.$in) {
      extra.acceptanceMissedBy = { $in: squadFilter.assignedTo.$in };
    }
  }
  if (query.filter === 'hot') {
    extra.$or = [{ isHot: true }, { leadScore: 'hot' }];
    extra.status = { $nin: ['converted', 'lost', 'booked_from_another_company'] };
  }
  if (!query.filter || query.filter === 'all' || query.filter === 'package-shared' || query.filter === 'package_shared') {
    if (query.status) extra.status = query.status;
    if (query.destination) extra.destination = query.destination;
    if (query.priority === 'hot') extra.isHot = true;
    else if (query.priority) extra.priority = query.priority;
  }
  const filter = withActiveLead(
    withBranch({ ...squadFilter, ...extra, ...buildLeadSearchFilter(query.search) }, options.branchId)
  );

  if (wantsPackageSharedLeads(query)) {
    const sharedIds = await findPackageSharedLeadIds({ branchId: options.branchId });
    filter._id = { $in: sharedIds.length ? sharedIds : [] };
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
