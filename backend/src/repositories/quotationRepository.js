const Lead = require('../models/Lead');
const Quotation = require('../models/Quotation');
const { QUOTATION_LIST_POPULATE, QUOTATION_LIST_SELECT, buildLeadSearchFilter } = require('../utils/queryHelpers');
const { parsePagination, parseSort, paginatedResponse } = require('../utils/pagination');
const { withBranch } = require('../utils/branchScope');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function intersectLeadIds(existing, next) {
  if (!existing?.$in?.length) return { $in: next };
  const allowed = new Set(next.map(String));
  const merged = existing.$in.filter((id) => allowed.has(String(id)));
  return { $in: merged };
}

async function applyQuotationQueryFilters(filter, query = {}, branchId) {
  const { status, executiveId, dateFrom, dateTo, destination, search } = query;

  if (status && filter.status === undefined) filter.status = status;
  if (executiveId) filter.createdByExecutive = executiveId;

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const destinationTrim = destination?.trim();
  const searchTrim = search?.trim();

  if (destinationTrim) {
    const leadQuery = {
      destination: new RegExp(`^${escapeRegex(destinationTrim)}$`, 'i'),
    };
    const leadIds = await Lead.find(withBranch(leadQuery, branchId)).distinct('_id');
    filter.lead = filter.lead?.$in
      ? intersectLeadIds(filter.lead, leadIds)
      : { $in: leadIds };
  }

  if (searchTrim) {
    const or = [{ quoteNumber: { $regex: searchTrim, $options: 'i' } }];
    if (Number.isFinite(Number(searchTrim))) {
      or.push({ 'pricing.total': Number(searchTrim) });
    }

    const searchLeadIds = await Lead.find(withBranch(buildLeadSearchFilter(searchTrim), branchId))
      .select('_id')
      .limit(200)
      .lean();
    if (searchLeadIds.length) {
      or.push({ lead: { $in: searchLeadIds.map((l) => l._id) } });
    }

    filter.$or = or;
  }

  return filter;
}

async function findQuotationsPaginated(query = {}, { branchId } = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 200 });
  const sort = parseSort(query, { createdAt: -1 });
  const filter = await applyQuotationQueryFilters(withBranch({}, branchId), query, branchId);

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

  return paginatedResponse(rows, { page, limit, total });
}

module.exports = {
  applyQuotationQueryFilters,
  findQuotationsPaginated,
};
