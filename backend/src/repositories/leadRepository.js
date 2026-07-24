const Lead = require('../models/Lead');
const { LEAD_LIST_SELECT } = require('../utils/leadQueryFields');
const { buildLeadSearchFilter, LEAD_LIST_POPULATE, enrichLead } = require('../utils/queryHelpers');
const {
  parsePagination,
  parseSort,
  paginatedResponse,
  encodeCursor,
  buildCursorFilter,
  DEEP_PAGE_THRESHOLD,
} = require('../utils/pagination');
const { withBranch } = require('../utils/branchScope');

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
    reactivationStage,
    reactivatedOnly,
    executiveId,
    reactivatedFrom,
    reactivatedTo,
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
  }
  if (destination) mongoFilter.destination = destination;
  if (source) mongoFilter.source = source;
  if (agent) mongoFilter.assignedTo = agent;

  if (budgetMin || budgetMax) {
    mongoFilter.budget = {};
    if (budgetMin) mongoFilter.budget.$gte = Number(budgetMin);
    if (budgetMax) mongoFilter.budget.$lte = Number(budgetMax);
  }

  if (dateFrom || dateTo) {
    mongoFilter.createdAt = {};
    if (dateFrom) mongoFilter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      mongoFilter.createdAt.$lte = end;
    }
  }

  if (travelMonth !== undefined && travelMonth !== '') {
    mongoFilter.$expr = { $eq: [{ $month: '$travelDate' }, Number(travelMonth) + 1] };
  }

  return mongoFilter;
}

async function findLeadsPaginated(query = {}, { branchId } = {}) {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, { createdAt: -1 });
  const sortField = Object.keys(sort)[0] || 'createdAt';
  const sortDir = sort[sortField] ?? -1;
  const filter = withBranch(buildLeadListFilter(query), branchId);

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
