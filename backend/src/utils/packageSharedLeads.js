const Quotation = require('../models/Quotation');
const { withBranch } = require('../utils/branchScope');

/**
 * Lead IDs that already have a package/quotation built or shared.
 * Used by quotation "Select Lead" default list and related views.
 */
async function findPackageSharedLeadIds({ branchId, extraFilter = {} } = {}) {
  const quoteFilter = withBranch(
    {
      ...extraFilter,
      $or: [
        { package: { $ne: null } },
        { packageSnapshot: { $exists: true, $ne: null } },
        { sentAt: { $exists: true, $ne: null } },
        { status: { $in: ['sent', 'viewed', 'negotiation', 'approved', 'pending_approval'] } },
      ],
    },
    branchId
  );

  const ids = await Quotation.distinct('lead', quoteFilter);
  return ids.filter(Boolean);
}

function wantsPackageSharedLeads(query = {}) {
  const flag = query.packageShared ?? query.package_shared;
  if (flag === '1' || flag === 'true' || flag === true) return true;
  const filter = String(query.filter || '').toLowerCase();
  return filter === 'package-shared' || filter === 'package_shared';
}

module.exports = {
  findPackageSharedLeadIds,
  wantsPackageSharedLeads,
};
