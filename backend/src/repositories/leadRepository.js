const Lead = require('../models/Lead');
const { LEAD_LIST_SELECT, withManagementFields, withManagementPopulate } = require('../utils/leadQueryFields');
const { buildLeadSearchFilter, LEAD_LIST_POPULATE, enrichLead, startOfDay, endOfDay, isConvertedListQuery, applyConvertedPeriodFilter } = require('../utils/queryHelpers');
const {
  parsePagination,
  parseSort,
  paginatedResponse,
  encodeCursor,
  buildCursorFilter,
  DEEP_PAGE_THRESHOLD,
} = require('../utils/pagination');
const { withBranch } = require('../utils/branchScope');
const {
  findPackageSharedLeadIds,
  wantsPackageSharedLeads,
} = require('../utils/packageSharedLeads');
const { applyListStatusBucket } = require('../utils/listStatusBucketFilter');
const { findConnectedLeadIds, wantsConnectedFilter, findCalledLeadIds } = require('../utils/connectedLeadIds');
const { attachFirstCall } = require('../utils/firstCallInfo');
const { resolveDestinationGroupValues } = require('../utils/destinationHierarchy');

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
  return endOfDay(new Date(dateStr));
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildLeadListFilter(query = {}, { branchId } = {}) {
  const {
    status,
    search,
    filter: listFilter,
    listStatus,
    statusReason,
    destination,
    destinationNames,
    source,
    agent,
    travelMonth,
    budgetMin,
    budgetMax,
    budgetMinExclusive,
    budgetMaxExclusive,
    dateFrom,
    dateTo,
    todayOnly,
    reactivationStage,
    reactivatedOnly,
    executiveId,
    reactivatedFrom,
    reactivatedTo,
    priority,
    teamId,
    state,
    engagementStatus,
  } = query;

  const mongoFilter = { ...buildLeadSearchFilter(search), isDeleted: { $ne: true } };

  if (status && !listStatus && !statusReason) mongoFilter.status = status;
  if (reactivatedOnly === 'true') mongoFilter['reactivation.isReactivated'] = true;
  if (reactivationStage) mongoFilter['reactivation.stage'] = reactivationStage;
  if (executiveId) mongoFilter.assignedTo = executiveId;
  const reactFrom = reactivatedFrom;
  const reactTo = reactivatedTo;
  if (reactFrom || reactTo) {
    mongoFilter['reactivation.reactivatedAt'] = {};
    if (reactFrom) mongoFilter['reactivation.reactivatedAt'].$gte = new Date(reactFrom);
    if (reactTo) {
      const end = new Date(reactTo);
      end.setHours(23, 59, 59, 999);
      mongoFilter['reactivation.reactivatedAt'].$lte = end;
    }
  }
  if (listFilter === 'unassigned') mongoFilter.assignedTo = null;
  else if (listFilter === 'assigned') mongoFilter.assignedTo = { $ne: null };
  else if (listFilter === 'hot') {
    mongoFilter.isHot = true;
    mongoFilter.status = { $nin: ['converted', 'lost', 'booked_from_another_company'] };
  } else if (listFilter === 'returned') {
    mongoFilter.assignedTo = null;
    mongoFilter.assignmentAcceptance = 'expired';
  } else if (listFilter === 'arrivals') {
    mongoFilter.status = 'converted';
  } else if (listFilter === 'bookings') {
    mongoFilter.status = 'converted';
  }
  if (destination) mongoFilter.destination = destination;
  if (source) mongoFilter.source = source;
  if (agent) mongoFilter.assignedTo = agent;
  if (teamId) mongoFilter.teamId = teamId;
  if (state) {
    mongoFilter.state = { $regex: `^${escapeRegex(state)}$`, $options: 'i' };
  }
  if (priority === 'hot') {
    mongoFilter.isHot = true;
  } else if (priority) {
    mongoFilter.priority = priority;
  }

  // Package Cost filter — reuses the same persisted Lead.budget field the Sales Executive
  // enters on lead creation. `*Exclusive` flags let the "Under ₹50K" / "₹1L – ₹2L" / etc.
  // ranges express > vs >= (and < vs <=) boundaries so adjacent ranges don't overlap; the
  // aggregate "Above ₹50K" option is the one range intentionally left open-ended and overlapping.
  if (budgetMin || budgetMax) {
    mongoFilter.budget = {};
    if (budgetMin) {
      mongoFilter.budget[budgetMinExclusive === 'true' ? '$gt' : '$gte'] = Number(budgetMin);
    }
    if (budgetMax) {
      mongoFilter.budget[budgetMaxExclusive === 'true' ? '$lt' : '$lte'] = Number(budgetMax);
    }
  }

  let dateRange = null;
  if (todayOnly === true || todayOnly === 'true') {
    dateRange = { $gte: startOfDay(), $lte: endOfDay() };
  } else if (dateFrom || dateTo) {
    dateRange = {};
    if (dateFrom) dateRange.$gte = parseLocalDayStart(dateFrom);
    if (dateTo) dateRange.$lte = parseLocalDayEnd(dateTo);
  }

  // Arrivals = travel date; Bookings/converted = conversion date; else lead createdAt
  if (dateRange) {
    if (listFilter === 'arrivals') {
      mongoFilter.travelDate = dateRange;
    } else if (isConvertedListQuery({ status: mongoFilter.status, filter: listFilter })) {
      applyConvertedPeriodFilter(mongoFilter, dateRange);
    } else {
      mongoFilter.createdAt = dateRange;
    }
  } else if (listFilter === 'arrivals') {
    mongoFilter.travelDate = { $exists: true, $ne: null };
  }

  if (travelMonth !== undefined && travelMonth !== '') {
    mongoFilter.$expr = { $eq: [{ $month: '$travelDate' }, Number(travelMonth) + 1] };
  }

  applyListStatusBucket(mongoFilter, listStatus, statusReason);

  // Connected = at least one CallNote whose outcome is in the canonical "connected"
  // bucket (see CallNote.OUTCOME_BUCKETS). Uses $and rather than mongoFilter._id so it
  // composes safely with the duplicates/package-shared id filters applied by the caller.
  if (wantsConnectedFilter(query)) {
    const connectedIds = await findConnectedLeadIds({ branchId });
    if (!mongoFilter.$and) mongoFilter.$and = [];
    mongoFilter.$and.push({ _id: { $in: connectedIds } });
  }

  // Engagement Status (Admin "Engagement Status" filter) — Not Opened / Opened, Not Called /
  // Opened & Called, using only Lead.firstOpenedAt and CallNote existence exactly as they
  // already mean elsewhere (see utils/firstCallInfo.js's lead-wide, outcome-agnostic "First
  // Call"). "Called" is intentionally not scoped to the assigned executive or any outcome.
  if (engagementStatus === 'not_opened') {
    mongoFilter.firstOpenedAt = null;
  } else if (engagementStatus === 'opened_not_called' || engagementStatus === 'opened_called') {
    mongoFilter.firstOpenedAt = { $ne: null };
    const calledIds = await findCalledLeadIds({ branchId });
    if (!mongoFilter.$and) mongoFilter.$and = [];
    mongoFilter.$and.push({
      _id: engagementStatus === 'opened_called' ? { $in: calledIds } : { $nin: calledIds },
    });
  }

  // Top Destinations drill-down: resolve rollup name(s) (a state, or the "Other" bucket) back to
  // the exact raw destination values via the same state-hierarchy logic the chart itself uses,
  // scoped by everything else already applied above (branch/status/date range/etc.). Takes
  // precedence over a plain exact-match `destination` param.
  if (destinationNames) {
    const names = String(destinationNames)
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length) {
      const resolutionScope = withBranch({ ...mongoFilter }, branchId);
      delete resolutionScope.destination;
      const values = await resolveDestinationGroupValues(names, resolutionScope);
      mongoFilter.destination = { $in: values };
    }
  }

  return mongoFilter;
}

/**
 * The complete effective Mongo filter for the Admin All Leads list — every Filters-panel field
 * (via buildLeadListFilter) plus branch scoping plus the id-narrowing filters (duplicates /
 * package-shared) that can't be expressed as plain field matches. Shared by the leads list query
 * and the KPI strip (leadListKpiService) so both always see exactly the same filtered set.
 */
async function buildEffectiveLeadFilter(query = {}, { branchId } = {}) {
  const filter = withBranch(await buildLeadListFilter(query, { branchId }), branchId);

  if (query.filter === 'duplicates') {
    const { findDuplicateLeadIds } = require('../services/leadListKpiService');
    const ids = await findDuplicateLeadIds(branchId);
    filter._id = { $in: ids.length ? ids : [] };
  }

  if (wantsPackageSharedLeads(query)) {
    const ids = await findPackageSharedLeadIds({ branchId });
    filter._id = { $in: ids.length ? ids : [] };
  }

  // Status Movement (Admin "Status Movement" filter) — leads that have ever recorded the
  // requested Cold/Warm/Hot bucket transition, per LeadStatusMovement (see
  // leadStatusMovementService). Queries the transition ledger, never infers movement from the
  // Lead document's current status/statusReason. Intersected with any id-narrowing already
  // applied above so it composes correctly if ever combined with duplicates/package-shared.
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

async function findLeadsPaginated(query = {}, { branchId, includeManagementFields = false } = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(
    query,
    isConvertedListQuery(query) ? { convertedAt: -1, updatedAt: -1 } : { createdAt: -1 }
  );
  const sortField = Object.keys(sort)[0] || 'createdAt';
  const sortDir = sort[sortField] ?? -1;
  const filter = await buildEffectiveLeadFilter(query, { branchId });

  // Expired acceptances are handled by notificationScheduler — not on every list request

  const useCursor = Boolean(query.cursor);
  const listFilter = useCursor
    ? buildCursorFilter(filter, query.cursor, sortField, sortDir)
    : filter;

  const fetchLimit = useCursor ? limit + 1 : limit;

  const needsTotal = !useCursor && page <= DEEP_PAGE_THRESHOLD;

  let [rows, total] = await Promise.all([
    Lead.find(listFilter)
      .select(withManagementFields(LEAD_LIST_SELECT, includeManagementFields))
      .populate(withManagementPopulate(LEAD_LIST_POPULATE, includeManagementFields))
      .sort(sort)
      .skip(useCursor ? 0 : skip)
      .limit(fetchLimit)
      .lean(),
    needsTotal ? Lead.countDocuments(filter) : Promise.resolve(null),
  ]);

  let nextCursor = null;
  if (useCursor && rows.length > limit) {
    rows = rows.slice(0, limit);
    nextCursor = encodeCursor(rows[rows.length - 1], sortField);
  } else if (!useCursor && page === DEEP_PAGE_THRESHOLD && rows.length > 0) {
    nextCursor = encodeCursor(rows[rows.length - 1], sortField);
  }

  let enriched = rows.map(enrichLead);
  if (query.status === 'converted' || filter.status === 'converted') {
    const { attachPaymentSummariesToLeads } = require('../services/paymentReceiptService');
    enriched = await attachPaymentSummariesToLeads(enriched);
  }
  await attachFirstCall(enriched);

  return paginatedResponse(enriched, {
    page,
    limit,
    total,
    nextCursor,
    hasMore: Boolean(nextCursor),
  });
}

async function countLeads(query = {}, { branchId } = {}) {
  return Lead.countDocuments(withBranch(await buildLeadListFilter(query, { branchId }), branchId));
}

module.exports = {
  buildLeadListFilter,
  buildEffectiveLeadFilter,
  findLeadsPaginated,
  countLeads,
};
