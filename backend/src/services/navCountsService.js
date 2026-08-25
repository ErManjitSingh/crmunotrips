const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const Package = require('../models/Package');
const { getUnoPackagesTotal } = require('./unoHotelsPackageService');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const SupportTicket = require('../models/SupportTicket');
const TripTask = require('../models/TripTask');
const mongoose = require('mongoose');
const { getExecutiveIdsForLeader } = require('./teamScopeService');
const { buildExecutiveStallQuery } = require('./leadExecutiveStallService');
const { withBranch } = require('../utils/branchScope');
const { getReminderCounts } = require('./reminderService');

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
        whatsapp: [
          { $match: { source: { $in: ['whatsapp', 'dpw_wa', 'dpw2_wa'] } } },
          { $count: 'n' },
        ],
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
        returned: [
          {
            $match: {
              assignedTo: null,
              assignmentAcceptance: 'expired',
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
    returned: facetCount(row, 'returned'),
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
    reminderCounts,
  ] = await Promise.all([
    aggregateAdminLeadCounts(branchId),
    FollowUp.countDocuments(withBranch({ status: 'pending' }, branchId)),
    countFollowUpsDue({}, branchId),
    Lead.countDocuments(
      withBranch(
        {
          isDeleted: { $ne: true },
          $or: [{ status: 'converted' }, { isRepeatCustomer: true }],
        },
        branchId
      )
    ),
    Quotation.countDocuments(withBranch({}, branchId)),
    Quotation.countDocuments(withBranch({ status: 'pending_approval' }, branchId)),
    getUnoPackagesTotal().catch(() => Package.countDocuments()),
    unreadNotifications(userId, branchId),
    countFollowUpsToday({}, branchId),
    buildOperationsNavCounts(userId, { branchId }),
    getReminderCounts({ _id: userId, role: 'admin' }, branchId),
  ]);

  return {
    leads,
    followups: { total: followUpsTotal, due: followUpsDue },
    customers,
    quotations: { total: quotationsTotal, pending: quotationsPending },
    packages,
    notifications: { unread: notificationsUnread },
    calendar: { today: calendarToday },
    reminders: { overdue: reminderCounts?.overdue || 0 },
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
        workingProgress: [{ $match: { status: 'working_progress' } }, { $count: 'n' }],
        needsAttention: [{ $match: stallMatch }, { $count: 'n' }],
        lost: [
          { $match: { status: { $in: ['lost', 'booked_from_another_company'] } } },
          { $count: 'n' },
        ],
        reactivated: [{ $match: { 'reactivation.isReactivated': true } }, { $count: 'n' }],
        returned: [
          {
            $match: {
              assignedTo: null,
              assignmentAcceptance: 'expired',
            },
          },
          { $count: 'n' },
        ],
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
    workingProgress: facetCount(row, 'workingProgress'),
    needsAttention: facetCount(row, 'needsAttention'),
    lost: facetCount(row, 'lost'),
    reactivated: facetCount(row, 'reactivated'),
    returned: facetCount(row, 'returned'),
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
  const { startOfToday, endOfToday } = todayRange();
  const createdById =
    userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(String(userId))
      : userId;
  // Repeated leads live only under Repeated menu — exclude from Total / pipeline KPIs
  const notRepeated = { isRepeatCustomer: { $ne: true } };
  const activeOpen = {
    ...notRepeated,
    status: { $nin: ['lost', 'booked_from_another_company', 'converted'] },
  };
  const [row] = await Lead.aggregate([
    { $match: match },
    {
      $facet: {
        all: [{ $match: activeOpen }, { $count: 'n' }],
        selfAdded: [
          {
            $match: {
              ...activeOpen,
              createdBy: createdById,
            },
          },
          { $count: 'n' },
        ],
        repeated: [{ $match: { isRepeatCustomer: true } }, { $count: 'n' }],
        new: [
          {
            $match: {
              ...activeOpen,
              $or: [
                { createdAt: { $gte: startOfToday, $lte: endOfToday } },
                { assignedAt: { $gte: startOfToday, $lte: endOfToday } },
              ],
            },
          },
          { $count: 'n' },
        ],
        contacted: [{ $match: { ...notRepeated, status: 'contacted' } }, { $count: 'n' }],
        workingProgress: [
          { $match: { ...notRepeated, status: 'working_progress' } },
          { $count: 'n' },
        ],
        followUp: [
          {
            $match: {
              ...notRepeated,
              status: { $in: ['follow_up', 'negotiation'] },
            },
          },
          { $count: 'n' },
        ],
        hot: [
          {
            $match: {
              ...notRepeated,
              isHot: true,
              status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        converted: [
          { $match: { ...notRepeated, status: 'converted' } },
          { $count: 'n' },
        ],
        lost: [
          {
            $match: {
              ...notRepeated,
              status: { $in: ['lost', 'booked_from_another_company'] },
            },
          },
          { $count: 'n' },
        ],
        reactivated: [
          {
            $match: {
              ...notRepeated,
              'reactivation.isReactivated': true,
              status: { $nin: ['lost', 'booked_from_another_company', 'converted'] },
            },
          },
          { $count: 'n' },
        ],
        urgent: [
          {
            $match: {
              ...notRepeated,
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
      },
    },
  ]);

  return {
    leads: {
      all: facetCount(row, 'all'),
      selfAdded: facetCount(row, 'selfAdded'),
      repeated: facetCount(row, 'repeated'),
      new: facetCount(row, 'new'),
      contacted: facetCount(row, 'contacted'),
      workingProgress: facetCount(row, 'workingProgress'),
      followUp: facetCount(row, 'followUp'),
      hot: facetCount(row, 'hot'),
      converted: facetCount(row, 'converted'),
      lost: facetCount(row, 'lost'),
      reactivated: facetCount(row, 'reactivated'),
      urgent: facetCount(row, 'urgent'),
      returned: 0,
    },
    customers: facetCount(row, 'customers'),
  };
}

async function buildExecutiveNavCounts(userId, { branchId } = {}) {
  const [aggregated, followUpsDue, notificationsUnread, quotationsTotal, returnedCount] = await Promise.all([
    aggregateExecutiveLeadCounts(userId, branchId),
    countFollowUpsDue({ assignedTo: userId }, branchId),
    unreadNotifications(userId, branchId),
    Quotation.countDocuments({
      ...(branchId ? { branchId } : {}),
      createdByExecutive: userId,
    }),
    Lead.countDocuments(
      withBranch(
        {
          isDeleted: { $ne: true },
          acceptanceMissedBy: userId,
          assignmentAcceptance: 'expired',
          assignedTo: null,
        },
        branchId
      )
    ),
  ]);

  const { leads, customers } = aggregated;
  leads.returned = returnedCount;

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
        workingProgress: [{ $match: { status: 'working_progress' } }, { $count: 'n' }],
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
      },
    },
  ]);

  return {
    all: facetCount(row, 'all'),
    statusNew: facetCount(row, 'statusNew'),
    hot: facetCount(row, 'hot'),
    inProgress: facetCount(row, 'inProgress'),
    workingProgress: facetCount(row, 'workingProgress'),
    needsAttention: facetCount(row, 'needsAttention'),
    lost: facetCount(row, 'lost'),
    reactivated: facetCount(row, 'reactivated'),
    escalations: facetCount(row, 'escalations'),
    returned: 0,
  };
}

async function buildTeamLeaderNavCounts(userId, { branchId } = {}) {
  const execIds = await getExecutiveIdsForLeader(userId);
  const squadFilter = withBranch(
    execIds.length
      ? { assignedTo: { $in: execIds }, isDeleted: { $ne: true } }
      : { assignedTo: null, isDeleted: { $ne: true } },
    branchId
  );
  const aggregated = await aggregateTeamLeaderLeadCounts(squadFilter);

  const quoteBase = execIds.length
    ? {
        $or: [{ teamLeader: userId }, { createdByExecutive: { $in: execIds } }],
      }
    : { teamLeader: userId };

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
    returnedCount,
  ] = await Promise.all([
    countFollowUpsDue(squadFollowFilter, branchId),
    Quotation.countDocuments(withBranch({ ...quoteBase, status: 'pending_approval' }, branchId)),
    Quotation.countDocuments(withBranch({ ...quoteBase, status: 'negotiation' }, branchId)),
    Quotation.countDocuments(withBranch({ ...quoteBase, status: 'approved' }, branchId)),
    Quotation.countDocuments(withBranch({ ...quoteBase, status: 'rejected' }, branchId)),
    unreadNotifications(userId, branchId),
    Lead.countDocuments(
      withBranch(
        {
          isDeleted: { $ne: true },
          assignedTo: null,
          assignmentAcceptance: 'expired',
          ...(execIds.length ? { acceptanceMissedBy: { $in: execIds } } : {}),
        },
        branchId
      )
    ),
  ]);

  return {
    leads: {
      all: aggregated.all,
      statusNew: aggregated.statusNew,
      hot: aggregated.hot,
      inProgress: aggregated.inProgress,
      workingProgress: aggregated.workingProgress,
      needsAttention: aggregated.needsAttention,
      lost: aggregated.lost,
      reactivated: aggregated.reactivated,
      returned: returnedCount,
    },
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
