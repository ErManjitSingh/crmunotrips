const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const Package = require('../models/Package');
const { getUnoPackagesTotal } = require('./unoHotelsPackageService');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const SupportTicket = require('../models/SupportTicket');
const TripTask = require('../models/TripTask');
const { getExecutiveIdsForLeader } = require('./teamScopeService');
const { buildExecutiveStallQuery } = require('./leadExecutiveStallService');
const { withBranch } = require('../utils/branchScope');

function todayRange() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return { startOfToday, endOfToday };
}

async function countHotLeads(extra = {}, branchId = null) {
  return Lead.countDocuments({
    ...withBranch(extra, branchId),
    isHot: true,
    status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
  });
}

async function countFollowUpsDue(extra = {}, branchId = null) {
  const { endOfToday } = todayRange();
  return FollowUp.countDocuments({
    ...withBranch(extra, branchId),
    status: 'pending',
    scheduledAt: { $lte: endOfToday },
  });
}

async function countFollowUpsToday(extra = {}, branchId = null) {
  const { startOfToday, endOfToday } = todayRange();
  return FollowUp.countDocuments({
    ...withBranch(extra, branchId),
    status: 'pending',
    scheduledAt: { $gte: startOfToday, $lte: endOfToday },
  });
}

async function unreadNotifications(userId, branchId = null) {
  return Notification.countDocuments(withBranch({ user: userId, read: false }, branchId));
}

function facetCount(facet, key) {
  return facet?.[key]?.[0]?.n ?? 0;
}

/** Single aggregation for lead sidebar counts — replaces 7 separate countDocuments */
async function aggregateAdminLeadCounts(branchId) {
  const match = withBranch({ isDeleted: { $ne: true } }, branchId);
  const { startOfToday, endOfToday } = todayRange();
  const [row] = await Lead.aggregate([
    { $match: match },
    {
      $facet: {
        all: [{ $count: 'n' }],
        new: [
          { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday } } },
          { $count: 'n' },
        ],
        unassigned: [{ $match: { assignedTo: null } }, { $count: 'n' }],
        assigned: [{ $match: { assignedTo: { $ne: null } } }, { $count: 'n' }],
        converted: [{ $match: { status: 'converted' } }, { $count: 'n' }],
        lost: [{ $match: { status: { $in: ['lost', 'booked_from_another_company'] } } }, { $count: 'n' }],
        whatsapp: [{ $match: { source: 'whatsapp' } }, { $count: 'n' }],
        statusNew: [{ $match: { status: 'new' } }, { $count: 'n' }],
        hot: [
          {
            $match: {
              isHot: true,
              status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
      },
    },
  ]);

  return {
    all: facetCount(row, 'all'),
    new: facetCount(row, 'new'),
    unassigned: facetCount(row, 'unassigned'),
    assigned: facetCount(row, 'assigned'),
    converted: facetCount(row, 'converted'),
    lost: facetCount(row, 'lost'),
    whatsapp: facetCount(row, 'whatsapp'),
    statusNew: facetCount(row, 'statusNew'),
    hot: facetCount(row, 'hot'),
  };
}

async function buildAdminNavCounts(userId, { branchId } = {}) {
  const [
    leads,
    followUpsTotal,
    followUpsDue,
    customers,
    quotationsTotal,
    quotationsPending,
    packages,
    notificationsUnread,
    calendarToday,
    opsCounts,
  ] = await Promise.all([
    aggregateAdminLeadCounts(branchId),
    FollowUp.countDocuments(withBranch({ status: 'pending' }, branchId)),
    countFollowUpsDue({}, branchId),
    Lead.countDocuments({
      $or: [{ status: 'converted' }, { isRepeatCustomer: true }],
    }),
    Quotation.countDocuments(withBranch({}, branchId)),
    Quotation.countDocuments(withBranch({ status: 'pending_approval' }, branchId)),
    getUnoPackagesTotal().catch(() => Package.countDocuments()),
    unreadNotifications(userId, branchId),
    countFollowUpsToday({}, branchId),
    buildOperationsNavCounts(userId, { branchId }),
  ]);

  return {
    leads,
    followups: { total: followUpsTotal, due: followUpsDue },
    customers,
    quotations: { total: quotationsTotal, pending: quotationsPending },
    packages,
    notifications: { unread: notificationsUnread },
    calendar: { today: calendarToday },
    bookings: opsCounts.bookings,
    support: opsCounts.support,
    tasks: opsCounts.tasks,
  };
}

async function aggregateSalesManagerLeadCounts(branchId) {
  const match = withBranch({ isDeleted: { $ne: true } }, branchId);
  const stallMatch = buildExecutiveStallQuery();
  const [row] = await Lead.aggregate([
    { $match: match },
    {
      $facet: {
        all: [{ $count: 'n' }],
        statusNew: [{ $match: { status: 'new' } }, { $count: 'n' }],
        unassigned: [{ $match: { assignedTo: null } }, { $count: 'n' }],
        assigned: [{ $match: { assignedTo: { $ne: null } } }, { $count: 'n' }],
        hot: [
          {
            $match: {
              isHot: true,
              status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        inProgress: [
          {
            $match: {
              status: {
                $in: ['contacted', 'working_progress', 'follow_up', 'negotiation', 'quotation_sent', 'reactivated'],
              },
            },
          },
          { $count: 'n' },
        ],
        needsAttention: [{ $match: stallMatch }, { $count: 'n' }],
        lost: [
          { $match: { status: { $in: ['lost', 'booked_from_another_company'] } } },
          { $count: 'n' },
        ],
        reactivated: [{ $match: { 'reactivation.isReactivated': true } }, { $count: 'n' }],
      },
    },
  ]);

  return {
    all: facetCount(row, 'all'),
    statusNew: facetCount(row, 'statusNew'),
    unassigned: facetCount(row, 'unassigned'),
    assigned: facetCount(row, 'assigned'),
    hot: facetCount(row, 'hot'),
    inProgress: facetCount(row, 'inProgress'),
    needsAttention: facetCount(row, 'needsAttention'),
    lost: facetCount(row, 'lost'),
    reactivated: facetCount(row, 'reactivated'),
  };
}

async function buildSalesManagerNavCounts(userId, { branchId } = {}) {
  const [
    leads,
    followUpsDue,
    quotationsPending,
    quotationsApproved,
    quotationsRejected,
    notificationsUnread,
    calendarToday,
  ] = await Promise.all([
    aggregateSalesManagerLeadCounts(branchId),
    countFollowUpsDue({}, branchId),
    Quotation.countDocuments(withBranch({ status: { $in: ['sent', 'negotiation', 'pending_approval'] } }, branchId)),
    Quotation.countDocuments(withBranch({ status: 'approved' }, branchId)),
    Quotation.countDocuments(withBranch({ status: 'rejected' }, branchId)),
    unreadNotifications(userId, branchId),
    countFollowUpsToday({}, branchId),
  ]);

  return {
    leads,
    assignment: leads.unassigned,
    followups: { due: followUpsDue },
    quotations: {
      pending: quotationsPending,
      approved: quotationsApproved,
      rejected: quotationsRejected,
    },
    notifications: { unread: notificationsUnread },
    calendar: { today: calendarToday },
  };
}

/** Single aggregation for executive lead sidebar counts — replaces 8+ countDocuments */
async function aggregateExecutiveLeadCounts(userId, branchId) {
  const match = withBranch({ assignedTo: userId, isDeleted: { $ne: true } }, branchId);
  const [row] = await Lead.aggregate([
    { $match: match },
    {
      $facet: {
        all: [{ $count: 'n' }],
        new: [{ $match: { status: 'new' } }, { $count: 'n' }],
        contacted: [{ $match: { status: 'contacted' } }, { $count: 'n' }],
        followUp: [{ $match: { status: { $in: ['follow_up', 'negotiation'] } } }, { $count: 'n' }],
        hot: [
          {
            $match: {
              isHot: true,
              status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        converted: [{ $match: { status: 'converted' } }, { $count: 'n' }],
        lost: [{ $match: { status: { $in: ['lost', 'booked_from_another_company'] } } }, { $count: 'n' }],
        reactivated: [
          { $match: { 'reactivation.isReactivated': true, status: 'reactivated' } },
          { $count: 'n' },
        ],
        urgent: [
          {
            $match: {
              priority: 'urgent',
              status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        customers: [
          { $match: { $or: [{ status: 'converted' }, { isRepeatCustomer: true }] } },
          { $count: 'n' },
        ],
        leadIds: [{ $project: { _id: 1 } }],
      },
    },
  ]);

  return {
    leads: {
      all: facetCount(row, 'all'),
      new: facetCount(row, 'new'),
      contacted: facetCount(row, 'contacted'),
      followUp: facetCount(row, 'followUp'),
      hot: facetCount(row, 'hot'),
      converted: facetCount(row, 'converted'),
      lost: facetCount(row, 'lost'),
      reactivated: facetCount(row, 'reactivated'),
      urgent: facetCount(row, 'urgent'),
    },
    customers: facetCount(row, 'customers'),
    leadIds: (row?.leadIds || []).map((l) => l._id),
  };
}

async function buildExecutiveNavCounts(userId, { branchId } = {}) {
  const [aggregated, followUpsDue, notificationsUnread] = await Promise.all([
    aggregateExecutiveLeadCounts(userId, branchId),
    countFollowUpsDue({ assignedTo: userId }, branchId),
    unreadNotifications(userId, branchId),
  ]);

  const { leads, customers, leadIds } = aggregated;
  const quotationsTotal = leadIds.length
    ? await Quotation.countDocuments({
        ...(branchId ? { branchId } : {}),
        $or: [{ createdByExecutive: userId }, { lead: { $in: leadIds } }],
      })
    : 0;

  return {
    leads,
    followups: { due: followUpsDue },
    quotations: { total: quotationsTotal },
    customers,
    notifications: { unread: notificationsUnread },
  };
}

async function aggregateTeamLeaderLeadCounts(squadFilter) {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
  const stallMatch = buildExecutiveStallQuery();
  const [row] = await Lead.aggregate([
    { $match: squadFilter },
    {
      $facet: {
        all: [{ $count: 'n' }],
        statusNew: [{ $match: { status: 'new' } }, { $count: 'n' }],
        hot: [
          {
            $match: {
              $or: [{ isHot: true }, { leadScore: 'hot' }],
              status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        inProgress: [
          {
            $match: {
              status: {
                $in: ['contacted', 'working_progress', 'follow_up', 'negotiation', 'quotation_sent', 'reactivated'],
              },
            },
          },
          { $count: 'n' },
        ],
        needsAttention: [{ $match: stallMatch }, { $count: 'n' }],
        lost: [
          { $match: { status: { $in: ['lost', 'booked_from_another_company'] } } },
          { $count: 'n' },
        ],
        reactivated: [{ $match: { 'reactivation.isReactivated': true } }, { $count: 'n' }],
        escalations: [
          {
            $match: {
              $or: [
                {
                  status: { $in: ['follow_up', 'negotiation', 'quotation_sent'] },
                  updatedAt: { $lt: fiveDaysAgo },
                },
                {
                  budget: { $gte: 200000 },
                  status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
                },
              ],
            },
          },
          { $count: 'n' },
        ],
        leadIds: [{ $project: { _id: 1 } }],
      },
    },
  ]);

  return {
    all: facetCount(row, 'all'),
    statusNew: facetCount(row, 'statusNew'),
    hot: facetCount(row, 'hot'),
    inProgress: facetCount(row, 'inProgress'),
    needsAttention: facetCount(row, 'needsAttention'),
    lost: facetCount(row, 'lost'),
    reactivated: facetCount(row, 'reactivated'),
    escalations: facetCount(row, 'escalations'),
    leadIds: (row?.leadIds || []).map((l) => l._id),
  };
}

async function buildTeamLeaderNavCounts(userId, { branchId } = {}) {
  const execIds = await getExecutiveIdsForLeader(userId);
  const squadFilter = withBranch(execIds.length ? { assignedTo: { $in: execIds } } : { assignedTo: null }, branchId);
  const aggregated = await aggregateTeamLeaderLeadCounts(squadFilter);
  const { leadIds } = aggregated;
  const quoteFilter = leadIds.length ? { lead: { $in: leadIds } } : { lead: null };

  const squadFollowFilter = execIds.length
    ? { assignedTo: { $in: execIds } }
    : { assignedTo: null };

  const [
    followUpsDue,
    quotationsPending,
    quotationsNegotiation,
    quotationsApproved,
    quotationsRejected,
    notificationsUnread,
  ] = await Promise.all([
    countFollowUpsDue(squadFollowFilter, branchId),
    Quotation.countDocuments(withBranch({ ...quoteFilter, status: 'pending_approval' }, branchId)),
    Quotation.countDocuments(withBranch({ ...quoteFilter, status: 'negotiation' }, branchId)),
    Quotation.countDocuments(withBranch({ ...quoteFilter, status: 'approved' }, branchId)),
    Quotation.countDocuments(withBranch({ ...quoteFilter, status: 'rejected' }, branchId)),
    unreadNotifications(userId, branchId),
  ]);

  return {
    leads: { all: aggregated.all, lost: aggregated.lost, reactivated: aggregated.reactivated },
    followups: { due: followUpsDue },
    escalations: aggregated.escalations,
    quotations: {
      pending: quotationsPending,
      negotiation: quotationsNegotiation,
      approved: quotationsApproved,
      rejected: quotationsRejected,
    },
    notifications: { unread: notificationsUnread },
  };
}

async function buildOperationsNavCounts(userId, { branchId } = {}) {
  const [
    bookingsPending,
    bookingsConfirmed,
    bookingsActive,
    bookingsCompleted,
    supportOpen,
    tasksPending,
    notificationsUnread,
  ] = await Promise.all([
    Booking.countDocuments(withBranch({ status: 'pending' }, branchId)),
    Booking.countDocuments(withBranch({ status: 'confirmed' }, branchId)),
    Booking.countDocuments(withBranch({ status: 'in_progress' }, branchId)),
    Booking.countDocuments(withBranch({ status: 'completed' }, branchId)),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    TripTask.countDocuments({ status: 'pending' }),
    unreadNotifications(userId, branchId),
  ]);

  return {
    bookings: {
      pending: bookingsPending,
      confirmed: bookingsConfirmed,
      active: bookingsActive,
      completed: bookingsCompleted,
    },
    support: { open: supportOpen },
    tasks: { pending: tasksPending },
    notifications: { unread: notificationsUnread },
  };
}

async function buildNavCounts(user, { branchId } = {}) {
  const role = user?.role || 'admin';
  const userId = user._id;

  switch (role) {
    case 'sales_manager':
      return buildSalesManagerNavCounts(userId, { branchId });
    case 'sales_executive':
      return buildExecutiveNavCounts(userId, { branchId });
    case 'team_leader':
      return buildTeamLeaderNavCounts(userId, { branchId });
    case 'operations_manager':
      return buildOperationsNavCounts(userId, { branchId });
    case 'admin':
    case 'manager':
    case 'accountant':
    default:
      return buildAdminNavCounts(userId, { branchId });
  }
}

module.exports = { buildNavCounts };
