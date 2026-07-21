const Quotation = require('../models/Quotation');

function quotationSideMatch({ branchId } = {}) {
  return {
    status: 'approved',
    $or: [
      { package: { $exists: true, $ne: null } },
      { 'packageSnapshot.name': { $exists: true, $nin: [null, ''] } },
    ],
    ...(branchId ? { branchId } : {}),
  };
}

/** Approved package quotation on a converted lead = realized team revenue. */
function packageQuotationMatch(extraLeadMatch = {}) {
  return {
    'leadDoc.status': 'converted',
    ...extraLeadMatch,
  };
}

function buildExecutiveLeadMatch({ assigneeId, assigneeIds, branchId } = {}) {
  const match = {};
  if (assigneeId) match['leadDoc.assignedTo'] = assigneeId;
  if (assigneeIds?.length) match['leadDoc.assignedTo'] = { $in: assigneeIds };
  if (branchId) match['leadDoc.branchId'] = branchId;
  return match;
}

async function sumConvertedPackageRevenue(options = {}) {
  const rows = await Quotation.aggregate([
    { $match: quotationSideMatch(options) },
    {
      $lookup: {
        from: 'leads',
        localField: 'lead',
        foreignField: '_id',
        as: 'leadDoc',
      },
    },
    { $unwind: '$leadDoc' },
    { $match: packageQuotationMatch(buildExecutiveLeadMatch(options)) },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: '$lead',
        amount: { $first: { $ifNull: ['$pricing.total', 0] } },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]);

  return rows[0]?.total || 0;
}

async function aggregateConvertedPackageRevenueByMonth(options = {}) {
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const rows = await Quotation.aggregate([
    { $match: quotationSideMatch(options) },
    {
      $lookup: {
        from: 'leads',
        localField: 'lead',
        foreignField: '_id',
        as: 'leadDoc',
      },
    },
    { $unwind: '$leadDoc' },
    { $match: packageQuotationMatch(buildExecutiveLeadMatch(options)) },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: { lead: '$lead', year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' } },
        amount: { $first: { $ifNull: ['$pricing.total', 0] } },
      },
    },
    {
      $group: {
        _id: { year: '$_id.year', month: '$_id.month' },
        revenue: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return rows.map((r) => ({
    month: MONTH_LABELS[(r._id.month || 1) - 1],
    revenue: r.revenue || 0,
  }));
}

module.exports = {
  sumConvertedPackageRevenue,
  aggregateConvertedPackageRevenueByMonth,
};
