const Lead = require('../models/Lead');
const { LEAD_LIST_SELECT } = require('../utils/leadQueryFields');
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

function buildLeadListFilter(query = {}) {
  const {
    status,
    search,
    filter: listFilter,
    destination,
    source,
    agent,
    travelMonth,
    budgetMin,
    budgetMax,
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
  } = query;

  const mongoFilter = { ...buildLeadSearchFilter(search), isDeleted: { $ne: true } };

  if (status) mongoFilter.status = status;
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

  if (budgetMin || budgetMax) {
    mongoFilter.budget = {};
    if (budgetMin) mongoFilter.budget.$gte = Number(budgetMin);
    if (budgetMax) mongoFilter.budget.$lte = Number(budgetMax);
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

  return mongoFilter;
}

async function findLeadsPaginated(query = {}, { branchId } = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(
    query,
    isConvertedListQuery(query) ? { convertedAt: -1, updatedAt: -1 } : { createdAt: -1 }
  );
  const sortField = Object.keys(sort)[0] || 'createdAt';
  const sortDir = sort[sortField] ?? -1;
  const filter = withBranch(buildLeadListFilter(query), branchId);

  if (query.filter === 'duplicates') {
    const { findDuplicateLeadIds } = require('../services/leadListKpiService');
    const ids = await findDuplicateLeadIds(branchId);
    filter._id = { $in: ids.length ? ids : [] };
  }

  if (wantsPackageSharedLeads(query)) {
    const ids = await findPackageSharedLeadIds({ branchId });
    filter._id = { $in: ids.length ? ids : [] };
  }

  // Expired acceptances are handled by notificationScheduler — not on every list request

  const useCursor = Boolean(query.cursor);
  const listFilter = useCursor
    ? buildCursorFilter(filter, query.cursor, sortField, sortDir)
    : filter;

  const fetchLimit = useCursor ? limit + 1 : limit;

  const needsTotal = !useCursor && page <= DEEP_PAGE_THRESHOLD;

  let [rows, total] = await Promise.all([
    Lead.find(listFilter)
      .select(LEAD_LIST_SELECT)
      .populate(LEAD_LIST_POPULATE)
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

  return paginatedResponse(enriched, {
    page,
    limit,
    total,
    nextCursor,
    hasMore: Boolean(nextCursor),
  });
}

async function countLeads(query = {}, { branchId } = {}) {
  return Lead.countDocuments(withBranch(buildLeadListFilter(query), branchId));
}

module.exports = {
  buildLeadListFilter,
  findLeadsPaginated,
  countLeads,
};
