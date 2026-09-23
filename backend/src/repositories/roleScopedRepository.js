const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { LEAD_LIST_SELECT, withManagementFields, withManagementPopulate } = require('../utils/leadQueryFields');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const { buildLeadListFilter } = require('./leadRepository');
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
  buildDueTodayFollowUpFilter,
  startOfDay,
  isConvertedListQuery,
  applyConvertedPeriodFilter,
} = require('../utils/queryHelpers');
const {
  parsePagination,
  parseSort,
  paginatedResponse,
  DEEP_PAGE_THRESHOLD,
} = require('../utils/pagination');
const { withBranch } = require('../utils/branchScope');
const { applyListStatusBucket } = require('../utils/listStatusBucketFilter');
const { applyQuotationQueryFilters } = require('./quotationRepository');
const {
  findPackageSharedLeadIds,
  wantsPackageSharedLeads,
} = require('../utils/packageSharedLeads');
const { attachFirstCall } = require('../utils/firstCallInfo');
const { applyPhoneVisibilityGate } = require('../utils/leadPhoneVisibility');

const LIST_PAGINATION = { defaultLimit: 20, maxLimit: 200 };

function parseLocalDayStart(dateStr) {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return startOfDay(new Date(dateStr));
}

function parseLocalDayEnd(dateStr) {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
  }
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return end;
}

function buildDateRange(query = {}) {
  if (!query.dateFrom && !query.dateTo) return null;
  const range = {};
  if (query.dateFrom) range.$gte = parseLocalDayStart(query.dateFrom);
  if (query.dateTo) range.$lte = parseLocalDayEnd(query.dateTo);
  return range;
}

function applyCreatedAtRange(filter, query = {}) {
  const range = buildDateRange(query);
  if (!range) return filter;
  if (isConvertedListQuery(query)) {
    return applyConvertedPeriodFilter(filter, range);
  }
  filter.createdAt = range;
  return filter;
}

function applyPeriodTouch(filter, query = {}) {
  const range = buildDateRange(query);
  if (!range) return filter;
  if (isConvertedListQuery(query)) {
    return applyConvertedPeriodFilter(filter, range);
  }
  const touch = {
    $or: [
      { createdAt: { ...range } },
      { assignedAt: { ...range } },
    ],
  };
  if (Array.isArray(filter.$and)) {
    filter.$and.push(touch);
  } else if (filter.$or) {
    filter.$and = [{ $or: filter.$or }, touch];
    delete filter.$or;
  } else {
    filter.$and = [touch];
  }
  return filter;
}

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

function isWorkingProgressFilter(filter) {
  return filter === 'working-progress' || filter === 'working_progress' || filter === 'working';
}

/**
 * Manager-only buckets (lost / reactivated / working-progress) keep their own dedicated
 * logic — Admin's Lead Management has no equivalent list-filter values for these. Every
 * other view (all/unassigned/assigned/hot/returned/arrivals/bookings) delegates to
 * buildLeadListFilter — the exact same filter builder Admin's Lead Management uses — so
 * Sales Manager gets full parity (search/source/destination/budget/executive/team/state/
 * priority/travel-month/connected/date-range routing) instead of a second, drifting
 * implementation of the same rules.
 */
async function buildManagerLeadFilter(query = {}, options = {}) {
  const { filter, search } = query;

  if (isWorkingProgressFilter(filter)) {
    const mongoFilter = { ...buildLeadSearchFilter(search), status: 'working_progress' };
    applyCreatedAtRange(mongoFilter, query);
    applyListStatusBucket(mongoFilter, query.listStatus);
    return mongoFilter;
  }
  if (filter === 'lost') {
    const mongoFilter = {
      ...buildLeadSearchFilter(search),
      status: { $in: ['lost', 'booked_from_another_company'] },
    };
    applyCreatedAtRange(mongoFilter, query);
    applyListStatusBucket(mongoFilter, query.listStatus);
    return mongoFilter;
  }
  if (filter === 'reactivated') {
    const mongoFilter = { ...buildLeadSearchFilter(search), 'reactivation.isReactivated': true };
    applyReactivationQueryFilters(mongoFilter, query);
    applyCreatedAtRange(mongoFilter, query);
    applyListStatusBucket(mongoFilter, query.listStatus);
    return mongoFilter;
  }

  return buildLeadListFilter(query, options);
}

/** Accepts only a well-formed Mongo ObjectId string — an untrusted query param must never
 * reach a raw Mongo filter unvalidated (a malformed value would otherwise throw a cast error). */
function parseValidObjectId(value) {
  if (!value) return null;
  const raw = String(value).trim();
  return mongoose.Types.ObjectId.isValid(raw) ? raw : null;
}

function buildExecutiveLeadFilter(filterKey, query = {}) {
  if (filterKey === 'new') {
    const range = buildDateRange(query) || {
      $gte: startOfDay(),
      $lte: (() => {
        const end = startOfDay();
        end.setHours(23, 59, 59, 999);
        return end;
      })(),
    };
    return {
      $or: [
        { createdAt: range },
        { assignedAt: range },
      ],
    };
  }
  // Connected = status contacted only (call picked). WIP is a separate filter.
  if (filterKey === 'contacted') {
    return { status: 'contacted' };
  }
  if (isWorkingProgressFilter(filterKey)) return { status: 'working_progress' };
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
  if (filterKey === 'duplicates' || filterKey === 'repeated') {
    return { isRepeatCustomer: true };
  }
  if (filterKey === 'returned') {
    return {
      assignmentAcceptance: 'expired',
      assignedTo: null,
    };
  }
  return {};
}

// Sales Manager's "All Leads" Branch filter is a read-only widening of this list only.
// Read from `leadBranchId`, NOT `branchId` — the generic `branchId` query param is
// inspected by the auth middleware (req.branchId resolution) for org-wide branch
// switching, and a non-org-wide role sending a mismatched `branchId` gets a 403 before
// this code ever runs. This dedicated param avoids that collision entirely, and never
// overwrites options.branchId (req.branchId) — every other manager endpoint (assign,
// quotations, dashboard, notifications, reports...) stays scoped to their own branch
// exactly as before. No branch picked -> falls back to their own branch, same as today.
function resolveManagerLeadBranchId(query = {}, options = {}) {
  const requestedBranchId = parseValidObjectId(query.leadBranchId);
  return requestedBranchId || options.branchId;
}

/**
 * The complete effective Mongo filter for the Sales Manager "All Leads" list — mirrors
 * leadRepository.buildEffectiveLeadFilter's Admin counterpart exactly, so the Leads List and the
 * KPI strip always see the same filtered set. Every Filters-panel field (via buildManagerLeadFilter,
 * which itself falls through to buildLeadListFilter) plus branch scoping plus the id-narrowing
 * filters (package-shared, Status Movement) that can't be expressed as plain field matches.
 */
async function buildEffectiveManagerLeadFilter(query = {}, options = {}) {
  const branchId = resolveManagerLeadBranchId(query, options);
  const built = await buildManagerLeadFilter(query, { branchId });
  const filter = withActiveLead(withBranch(built, branchId));

  if (wantsPackageSharedLeads(query)) {
    const ids = await findPackageSharedLeadIds({ branchId });
    filter._id = { $in: ids.length ? ids : [] };
  }

  // Status Movement (Admin/Sales Manager "Status Movement" filter — same query, same ledger,
  // see leadRepository.buildEffectiveLeadFilter's identical block for the Admin list). Queries
  // LeadStatusMovement only, never infers movement from the Lead document itself. Intersected
  // with any id-narrowing already applied above (package-shared) so it composes correctly.
  if (query.statusMovement) {
    const { findLeadIdsForMovement } = require('../services/leadStatusMovementService');
    const ids = await findLeadIdsForMovement(query.statusMovement, { branchId });
    const idSet = new Set(ids.map(String));
    if (filter._id && filter._id.$in) {
      filter._id = { $in: filter._id.$in.filter((id) => idSet.has(String(id))) };
    } else {
      filter._id = { $in: ids };
    }
  }

  return filter;
}

async function findManagerLeadsPaginated(query = {}, options = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, { createdAt: -1 });

  const filter = await buildEffectiveManagerLeadFilter(query, options);

  const needsTotal = page <= DEEP_PAGE_THRESHOLD;

  const [rows, total] = await Promise.all([
    Lead.find(filter)
      .select(withManagementFields(LEAD_LIST_SELECT, options.includeManagementFields))
      .populate(withManagementPopulate(LEAD_LIST_POPULATE, options.includeManagementFields))
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    needsTotal ? Lead.countDocuments(filter) : Promise.resolve(null),
  ]);

  let enriched = rows.map(enrichLead);
  await attachFirstCall(enriched);
  // Phone Number Visibility / Call-Gating: same gate as Admin (leadController.listLeads) and the
  // Sales Executive's own list below — the Sales Manager view must not leak the real number ahead
  // of a first logged call either. See utils/leadPhoneVisibility.
  enriched = await applyPhoneVisibilityGate(enriched);

  return paginatedResponse(enriched, {
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
  const sort = parseSort(
    query,
    filterKey === 'converted' ? { convertedAt: -1, updatedAt: -1 } : { createdAt: -1 }
  );

  // Expired acceptances are handled by notificationScheduler — not on every list request

  const searchPart = buildLeadSearchFilter(query.search);
  const statusExtras = buildExecutiveLeadFilter(filterKey, query);

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
  if (filterKey !== 'new') applyPeriodTouch(owned, query);

  const isRepeatedView = filterKey === 'duplicates' || filterKey === 'repeated';
  // Repeated leads only appear under Repeated menu
  if (!isRepeatedView) {
    owned.isRepeatCustomer = { $ne: true };
  }

  if (filterKey === 'hot') {
    owned.isHot = true;
    owned.status = { $nin: ['converted', 'lost', 'booked_from_another_company'] };
  }

  if (filterKey === 'all' || !filterKey || filterKey === 'package-shared' || filterKey === 'package_shared') {
    if (query.status) owned.status = query.status;
    else owned.status = { $nin: ['lost', 'booked_from_another_company', 'converted'] };
    if (query.destination) owned.destination = query.destination;
    if (query.state) owned.state = query.state;
    if (query.statusReason) {
      owned.statusReason = { $regex: String(query.statusReason).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    if (query.priority === 'hot') owned.isHot = true;
    else if (query.priority) owned.priority = query.priority;
  }

  if (isRepeatedView) {
    owned.isRepeatCustomer = true;
    // Show all assigned repeated (any status) so none hide in Total
    delete owned.status;
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
  // Phone Number Visibility / Call-Gating: the Sales Executive doesn't see the real number on
  // their own leads until they've logged a first call for it either — same gate as Admin (see
  // utils/leadPhoneVisibility). Already-masked returned-to-pool rows (assignedTo cleared above)
  // are simply re-masked as a no-op.
  enriched = await applyPhoneVisibilityGate(enriched);

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
  if (isWorkingProgressFilter(query.filter)) extra.status = 'working_progress';
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
  applyCreatedAtRange(filter, query);
  applyListStatusBucket(filter, query.listStatus);

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
  // Missed follow-ups must show the newest (most recently overdue) scheduledAt first, applied
  // server-side before pagination so page 1 is genuinely the newest globally — not just the
  // generic oldest-first default used by the other tabs.
  const isMissedTab = (query.tab || query.kpiTab) === 'missed';
  const sort = parseSort(query, isMissedTab ? { scheduledAt: -1 } : { scheduledAt: 1 });

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
  // Admin Follow-up Management "Today's Follow-ups" must match the Dashboard's "Follow-ups Due
  // Today" Action Required KPI population exactly (pending-only) — gated behind an option so the
  // executive's own follow-up summary (getExecutiveFollowUpSummary) keeps its existing
  // all-statuses "today" behavior, unchanged.
  const todayMatch = options.dueTodayOnly
    ? buildDueTodayFollowUpFilter()
    : { scheduledAt: { $gte: todayStart, $lte: todayEnd } };

  const [row] = await FollowUp.aggregate([
    { $match: scopedBase },
    {
      $facet: {
        total: [{ $count: 'n' }],
        today: [
          { $match: todayMatch },
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
  buildEffectiveManagerLeadFilter,
  resolveManagerLeadBranchId,
};
