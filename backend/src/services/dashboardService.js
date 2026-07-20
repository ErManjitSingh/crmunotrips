const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const Payment = require('../models/Payment');
const Package = require('../models/Package');
const User = require('../models/User');
const Team = require('../models/Team');
const Booking = require('../models/Booking');
const { startOfDay, endOfDay, enrichLead } = require('../utils/queryHelpers');
const {
  sumConvertedPackageRevenue,
  aggregateConvertedPackageRevenueByMonth,
} = require('../utils/convertedPackageRevenue');
const { getExecutiveIdsForLeader } = require('./teamScopeService');
const { getEnterpriseKpis, getSourceAnalytics, getExecutivePerformance } = require('./leadAnalyticsService');
const { getEmailDashboardStats } = require('./emailStatsService');
const { getMonthlyTarget, buildTargetProgress } = require('./salesTargetService');
const { withBranch } = require('../utils/branchScope');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASHBOARD_NEW_LEADS_LIMIT = 5;

const INTERESTED_STATUSES = ['contacted', 'working_progress', 'quotation_sent', 'reactivated'];
const LOST_STATUSES = ['lost', 'booked_from_another_company'];

function resolveReportPeriod(dateFrom, dateTo) {
  const now = new Date();
  const isAllTime = !dateFrom && !dateTo;
  const thisMonthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const prevMonthStart = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));

  if (isAllTime) {
    return {
      isAllTime: true,
      periodStart: startOfDay(new Date(2018, 0, 1)),
      periodEnd: endOfDay(now),
      prevStart: prevMonthStart,
      prevEnd: prevMonthEnd,
      momStart: thisMonthStart,
      momEnd: endOfDay(now),
    };
  }

  const periodEnd = dateTo ? endOfDay(new Date(dateTo)) : endOfDay(now);
  const periodStart = dateFrom ? startOfDay(new Date(dateFrom)) : thisMonthStart;
  const durationMs = Math.max(periodEnd.getTime() - periodStart.getTime(), 24 * 60 * 60 * 1000);
  const prevEnd = new Date(periodStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return {
    isAllTime: false,
    periodStart,
    periodEnd,
    prevStart,
    prevEnd,
    momStart: periodStart,
    momEnd: periodEnd,
  };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildLastNMonthBuckets(n, endDate = new Date()) {
  const buckets = [];
  const cursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d.getFullYear(), d.getMonth() + 1),
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      start: startOfDay(d),
      end: endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    });
  }
  return buckets;
}

async function sumRevenueInRange(branchId, start, end) {
  const rows = await Payment.aggregate([
    {
      $match: withBranch(
        { status: { $in: ['paid', 'partial'] }, paidAt: { $gte: start, $lte: end } },
        branchId
      ),
    },
    { $group: { _id: null, total: { $sum: '$paidAmount' } } },
  ]);
  return rows[0]?.total || 0;
}

function mapStatusBucket(statusCounts) {
  const fresh = statusCounts.new || 0;
  const followUpPending = statusCounts.follow_up || 0;
  const interested = INTERESTED_STATUSES.reduce((s, k) => s + (statusCounts[k] || 0), 0);
  const negotiation = statusCounts.negotiation || 0;
  const lost = LOST_STATUSES.reduce((s, k) => s + (statusCounts[k] || 0), 0);
  const conversions = statusCounts.converted || 0;
  return { fresh, followUpPending, interested, negotiation, lost, conversions };
}

function changeMeta(current, previous) {
  const change = pctChange(current, previous);
  return {
    value: current,
    previous,
    change,
    changeType: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
  };
}

const SOURCE_LABELS = {
  website: 'DPW',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  'walk-in': 'Walk-in',
  social: 'Facebook Ads',
  phone: 'Phone',
  other: 'Organic',
  google_ads: 'Google Ads',
  facebook_ads: 'Facebook Lead',
  organic: 'Organic',
  instagram: 'Instagram',
};

const SOURCE_COLORS = ['#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#64748B', '#EC4899', '#06B6D4'];

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatSourceName(source) {
  if (!source) return 'Other';
  return SOURCE_LABELS[source] || String(source).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function activeLeadScope(extra = {}, branchId) {
  return withBranch({ ...extra, isDeleted: { $ne: true } }, branchId);
}

async function buildReactivationWidget(branchId, assigneeIds = null) {
  const base = activeLeadScope({ 'reactivation.isReactivated': true }, branchId);
  if (Array.isArray(assigneeIds)) {
    base.assignedTo = assigneeIds.length ? { $in: assigneeIds } : null;
  }

  const [total, stageAgg, recent] = await Promise.all([
    Lead.countDocuments(base),
    Lead.aggregate([{ $match: base }, { $group: { _id: '$reactivation.stage', count: { $sum: 1 } } }]),
    Lead.find(base)
      .populate('assignedTo', 'name')
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean(),
  ]);
  const stageMap = Object.fromEntries(stageAgg.map((row) => [row._id || 'unknown', row.count]));

  return {
    totalReactivated: total,
    stageCounts: {
      reactivated: stageMap.reactivated || 0,
      reassigned: stageMap.reassigned || 0,
      contacted: stageMap.contacted || 0,
      followUpScheduled: stageMap.follow_up_scheduled || 0,
      quotationSent: stageMap.quotation_sent || 0,
      converted: stageMap.converted || 0,
    },
    liveProgress: recent.map((lead) => ({
      _id: lead._id,
      leadId: lead.leadId,
      name: lead.name,
      status: lead.status,
      stage: lead.reactivation?.stage || 'reactivated',
      stageUpdatedAt: lead.reactivation?.stageUpdatedAt || lead.updatedAt,
      executive: lead.assignedTo?.name || 'Unassigned',
    })),
  };
}

async function aggregateRevenueByMonth(match = {}, branchId = null) {
  const rows = await Payment.aggregate([
    { $match: withBranch({ ...match, status: { $in: ['paid', 'partial'] } }, branchId) },
    {
      $group: {
        _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
        revenue: { $sum: '$paidAmount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return rows.map((r) => ({
    month: MONTH_LABELS[(r._id.month || 1) - 1],
    revenue: r.revenue || 0,
  }));
}

async function buildAdminDashboard(options = {}) {
  const { branchId, dateFrom, dateTo, source } = options;
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const { isAllTime, periodStart, periodEnd, prevStart, prevEnd, momStart, momEnd } =
    resolveReportPeriod(dateFrom, dateTo);
  const sourceFilter = source ? { source } : {};
  const periodLeadScope = activeLeadScope(
    { createdAt: { $gte: periodStart, $lte: periodEnd }, ...sourceFilter },
    branchId
  );
  const prevLeadScope = activeLeadScope(
    { createdAt: { $gte: prevStart, $lte: prevEnd }, ...sourceFilter },
    branchId
  );
  const momLeadScope = activeLeadScope(
    { createdAt: { $gte: momStart, $lte: momEnd }, ...sourceFilter },
    branchId
  );
  const liveLeadScope = activeLeadScope({ ...sourceFilter }, branchId);
  const monthBuckets = buildLastNMonthBuckets(6, periodEnd);
  const trendStart = monthBuckets[0].start;

  const [
    totalLeads,
    todayLeads,
    convertedLeads,
    lostLeads,
    pendingFollowups,
    overdueFollowups,
    leadsByStatus,
    leadsBySource,
    budgetAgg,
    revenueAgg,
    recentLeadsRaw,
    newLeadsRaw,
    unassignedLeadsTotal,
    unassignedLeadsRaw,
    upcomingFollowups,
    topAgents,
    leadsWithoutBudget,
    leadsWithoutFollowup,
    hotLeadsCount,
    highBudgetLeadsCount,
    periodTotalLeads,
    prevTotalLeads,
    periodStatusAgg,
    prevStatusAgg,
    periodRevenue,
    prevRevenue,
    periodSourceAgg,
    momTotalLeads,
    momStatusAgg,
    momRevenue,
    monthlyLeadAgg,
    monthlyConvertedAgg,
    monthlyBookingAgg,
    monthlyPaymentAgg,
  ] = await Promise.all([
    Lead.countDocuments(activeLeadScope({}, branchId)),
    Lead.countDocuments(activeLeadScope({ createdAt: { $gte: todayStart, $lte: todayEnd } }, branchId)),
    Lead.countDocuments(activeLeadScope({ status: 'converted' }, branchId)),
    Lead.countDocuments(activeLeadScope({ status: { $in: LOST_STATUSES } }, branchId)),
    FollowUp.countDocuments(withBranch({ status: 'pending' }, branchId)),
    FollowUp.countDocuments({
      ...(branchId ? { branchId } : {}),
      $or: [{ status: 'missed' }, { status: 'pending', scheduledAt: { $lt: todayStart } }],
    }),
    Lead.aggregate([{ $match: activeLeadScope({}, branchId) }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: activeLeadScope({}, branchId) }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: activeLeadScope({}, branchId) }, { $group: { _id: null, total: { $sum: '$budget' } } }]),
    Payment.aggregate([
      { $match: withBranch({ status: { $in: ['paid', 'partial'] } }, branchId) },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
    Lead.find(activeLeadScope({}, branchId))
      .select('leadId name phone destination status budget assignedTo createdAt')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Lead.find(activeLeadScope({ createdAt: { $gte: todayStart, $lte: todayEnd } }, branchId))
      .select('leadId name phone destination status budget assignedTo createdAt')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(DASHBOARD_NEW_LEADS_LIMIT)
      .lean(),
    Lead.countDocuments(activeLeadScope({ assignedTo: null }, branchId)),
    Lead.find(activeLeadScope({ assignedTo: null }, branchId))
      .select('leadId name phone destination status budget createdAt')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(DASHBOARD_NEW_LEADS_LIMIT)
      .lean(),
    FollowUp.find(withBranch({ status: 'pending', scheduledAt: { $gte: new Date() } }, branchId))
      .populate('lead', 'name phone destination')
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean(),
    Lead.aggregate([
      { $match: withBranch({ status: 'converted', assignedTo: { $ne: null } }, branchId) },
      {
        $group: {
          _id: '$assignedTo',
          conversions: { $sum: 1 },
          revenue: { $sum: '$budget' },
        },
      },
      { $sort: { conversions: -1 } },
      { $limit: 5 },
    ]),
    Lead.countDocuments(activeLeadScope({ $or: [{ budget: { $exists: false } }, { budget: { $lte: 0 } }] }, branchId)),
    Lead.countDocuments(activeLeadScope({ $or: [{ nextFollowUp: { $exists: false } }, { nextFollowUp: null }] }, branchId)),
    Lead.countDocuments(activeLeadScope({ $or: [{ isHot: true }, { leadScore: 'hot' }] }, branchId)),
    Lead.countDocuments(activeLeadScope({ budget: { $gte: 60000 } }, branchId)),
    Lead.countDocuments(periodLeadScope),
    Lead.countDocuments(prevLeadScope),
    Lead.aggregate([{ $match: periodLeadScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: prevLeadScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    sumRevenueInRange(branchId, periodStart, periodEnd),
    sumRevenueInRange(branchId, prevStart, prevEnd),
    Lead.aggregate([{ $match: isAllTime ? liveLeadScope : periodLeadScope }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.countDocuments(momLeadScope),
    Lead.aggregate([{ $match: momLeadScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    sumRevenueInRange(branchId, momStart, momEnd),
    Lead.aggregate([
      {
        $match: activeLeadScope(
          { createdAt: { $gte: trendStart, $lte: periodEnd }, ...sourceFilter },
          branchId
        ),
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Lead.aggregate([
      {
        $match: activeLeadScope(
          {
            status: 'converted',
            createdAt: { $gte: trendStart, $lte: periodEnd },
            ...sourceFilter,
          },
          branchId
        ),
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: withBranch(
          {
            archivedAt: null,
            createdAt: { $gte: trendStart, $lte: periodEnd },
            status: { $nin: ['cancelled'] },
          },
          branchId
        ),
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: withBranch(
          {
            status: { $in: ['paid', 'partial'] },
            paidAt: { $gte: trendStart, $lte: periodEnd },
          },
          branchId
        ),
      },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          revenue: { $sum: '$paidAmount' },
        },
      },
    ]),
  ]);

  const agentIds = topAgents.map((a) => a._id);
  const agents = await User.find(withBranch({ _id: { $in: agentIds } }, branchId)).select('name').lean();
  const agentMap = Object.fromEntries(agents.map((a) => [a._id.toString(), a.name]));

  const conversionRate = totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;
  const totalBudget = budgetAgg[0]?.total || 0;
  const revenue = revenueAgg[0]?.total || 0;
  const monthlyRevenue = await aggregateRevenueByMonth({}, branchId);
  const reactivationWidget = await buildReactivationWidget(branchId);
  const [enterpriseKpis, sourceAnalytics, executivePerformance, emailStats] = await Promise.all([
    getEnterpriseKpis(branchId),
    getSourceAnalytics(branchId),
    getExecutivePerformance(branchId),
    getEmailDashboardStats({ branchId }),
  ]);

  const statusCounts = Object.fromEntries(leadsByStatus.map((s) => [s._id, s.count]));
  const periodStatusCounts = Object.fromEntries(periodStatusAgg.map((s) => [s._id, s.count]));
  const prevStatusCounts = Object.fromEntries(prevStatusAgg.map((s) => [s._id, s.count]));
  const momStatusCounts = Object.fromEntries(momStatusAgg.map((s) => [s._id, s.count]));
  const periodBuckets = mapStatusBucket(periodStatusCounts);
  const prevBuckets = mapStatusBucket(prevStatusCounts);
  const momBuckets = mapStatusBucket(momStatusCounts);
  const periodConversionRate = periodTotalLeads
    ? Math.round((periodBuckets.conversions / periodTotalLeads) * 1000) / 10
    : 0;
  const prevConversionRate = prevTotalLeads
    ? Math.round((prevBuckets.conversions / prevTotalLeads) * 1000) / 10
    : 0;
  const momConversionRate = momTotalLeads
    ? Math.round((momBuckets.conversions / momTotalLeads) * 1000) / 10
    : 0;

  const leadMap = Object.fromEntries(
    monthlyLeadAgg.map((r) => [monthKey(r._id.year, r._id.month), r.count])
  );
  const convertedMap = Object.fromEntries(
    monthlyConvertedAgg.map((r) => [monthKey(r._id.year, r._id.month), r.count])
  );
  const bookingMap = Object.fromEntries(
    monthlyBookingAgg.map((r) => [monthKey(r._id.year, r._id.month), r.count])
  );
  const paymentMap = Object.fromEntries(
    monthlyPaymentAgg.map((r) => [monthKey(r._id.year, r._id.month), r.revenue])
  );

  const monthlyLeadTrend = monthBuckets.map((b) => ({
    label: b.label,
    month: b.label,
    leadsGenerated: leadMap[b.key] || 0,
    convertedLeads: convertedMap[b.key] || 0,
  }));

  const conversionRateTrend = monthBuckets.map((b) => {
    const leads = leadMap[b.key] || 0;
    const converted = convertedMap[b.key] || 0;
    return {
      label: b.label,
      month: b.label,
      rate: leads ? Math.round((converted / leads) * 1000) / 10 : 0,
    };
  });

  const revenueVsBookings = monthBuckets.map((b) => ({
    label: b.label,
    month: b.label,
    bookings: bookingMap[b.key] || 0,
    revenue: paymentMap[b.key] || 0,
  }));

  const periodSourceTotal = periodSourceAgg.reduce((s, r) => s + r.count, 0) || 1;
  const leadsBySourcePeriod = periodSourceAgg
    .map((s, i) => ({
      name: formatSourceName(s._id),
      key: s._id || 'other',
      value: s.count,
      pct: Math.round((s.count / periodSourceTotal) * 1000) / 10,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const valueBuckets = {
    ...periodBuckets,
    followUpPending: isAllTime
      ? Math.max(periodBuckets.followUpPending, pendingFollowups)
      : periodBuckets.followUpPending,
  };
  const changeBuckets = isAllTime ? momBuckets : periodBuckets;
  const changeTotal = isAllTime ? momTotalLeads : periodTotalLeads;
  const changeRevenue = isAllTime ? momRevenue : periodRevenue;
  const changeConvRate = isAllTime ? momConversionRate : periodConversionRate;

  const statusDistributionTotal =
    valueBuckets.fresh +
    valueBuckets.followUpPending +
    valueBuckets.interested +
    valueBuckets.negotiation +
    valueBuckets.lost;
  const statusDistribution = [
    { name: 'Fresh Leads', key: 'fresh', value: valueBuckets.fresh, color: '#22C55E' },
    { name: 'Follow Up Pending', key: 'followUp', value: valueBuckets.followUpPending, color: '#F59E0B' },
    { name: 'Interested', key: 'interested', value: valueBuckets.interested, color: '#8B5CF6' },
    { name: 'Negotiation', key: 'negotiation', value: valueBuckets.negotiation, color: '#F97316' },
    { name: 'Lost Leads', key: 'lost', value: valueBuckets.lost, color: '#EF4444' },
  ].map((item) => ({
    ...item,
    pct: statusDistributionTotal ? Math.round((item.value / statusDistributionTotal) * 1000) / 10 : 0,
  }));

  const withValue = (meta, value) => ({ ...meta, value });
  const sameDayPrev = startOfDay(prevStart).getTime() === startOfDay(prevEnd).getTime();
  const prevPeriodLabel = sameDayPrev
    ? prevStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : `${prevStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${prevEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  const reportKpis = {
    totalLeads: withValue(changeMeta(changeTotal, prevTotalLeads), periodTotalLeads),
    freshLeads: withValue(changeMeta(changeBuckets.fresh, prevBuckets.fresh), valueBuckets.fresh),
    followUpPending: withValue(
      changeMeta(changeBuckets.followUpPending, prevBuckets.followUpPending),
      valueBuckets.followUpPending
    ),
    interested: withValue(changeMeta(changeBuckets.interested, prevBuckets.interested), valueBuckets.interested),
    negotiation: withValue(changeMeta(changeBuckets.negotiation, prevBuckets.negotiation), valueBuckets.negotiation),
    lostLeads: withValue(changeMeta(changeBuckets.lost, prevBuckets.lost), valueBuckets.lost),
    conversions: withValue(changeMeta(changeBuckets.conversions, prevBuckets.conversions), valueBuckets.conversions),
    revenue: withValue(changeMeta(changeRevenue, prevRevenue), periodRevenue),
    conversionRate: withValue(changeMeta(changeConvRate, prevConversionRate), periodConversionRate),
  };

  const topSource = leadsBySourcePeriod[0] || null;
  const topExecutive = (executivePerformance?.executives || [])[0] || null;
  const keyHighlights = {
    periodLabel: isAllTime
      ? 'All Time'
      : periodEnd.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    highestLeadsSource: topSource
      ? { name: topSource.name, pct: topSource.pct }
      : { name: '—', pct: 0 },
    bestPerformingExecutive: topExecutive
      ? { name: topExecutive.name, conversionRate: topExecutive.conversionRate }
      : { name: '—', conversionRate: 0 },
    conversionRate: periodConversionRate,
    revenueGenerated: periodRevenue,
  };

  const salesFunnel = [
    { stage: 'New Lead', count: statusCounts.new || 0 },
    { stage: 'Contacted', count: statusCounts.contacted || 0 },
    { stage: 'Follow Up', count: (statusCounts.follow_up || 0) + (statusCounts.negotiation || 0) },
    { stage: 'Quotation Sent', count: statusCounts.quotation_sent || 0 },
    { stage: 'Negotiation', count: statusCounts.negotiation || 0 },
    { stage: 'Converted', count: convertedLeads },
  ];

  const todayFollowUps = await FollowUp.find(withBranch({
    scheduledAt: { $gte: todayStart, $lte: todayEnd },
  }, branchId))
    .populate('lead', 'name phone')
    .sort({ scheduledAt: 1 })
    .limit(10)
    .lean();

  const sourceFilteredLeadSourceAnalytics = (periodSourceAgg.length ? periodSourceAgg : leadsBySource).map((s) => ({
    name: s._id || 'Unknown',
    value: s.count,
    pct: (periodSourceAgg.length ? periodSourceTotal : totalLeads)
      ? Math.round((s.count / (periodSourceAgg.length ? periodSourceTotal : totalLeads || 1)) * 100)
      : 0,
  }));

  const usePeriodAsPrimary = Boolean(dateFrom || dateTo);
  const primaryTotalLeads = usePeriodAsPrimary ? periodTotalLeads : totalLeads;
  const primaryConverted = usePeriodAsPrimary ? periodBuckets.conversions : convertedLeads;
  const primaryLost = usePeriodAsPrimary ? periodBuckets.lost : lostLeads;
  const primaryConversionRate = usePeriodAsPrimary ? periodConversionRate : conversionRate;
  const primaryRevenue = usePeriodAsPrimary ? periodRevenue : revenue;

  return {
    totalLeads: primaryTotalLeads,
    allTimeTotalLeads: totalLeads,
    todayLeads,
    newLeadsToday: todayLeads,
    followUpsToday: todayFollowUps.length,
    convertedLeads: primaryConverted,
    wonLeads: primaryConverted,
    lostLeads: primaryLost,
    pendingFollowups,
    overdueFollowups,
    conversionRate: primaryConversionRate,
    totalBudget,
    revenue: primaryRevenue,
    revenueChange: reportKpis.revenue.change,
    leadsByStatus: usePeriodAsPrimary ? periodStatusAgg : leadsByStatus,
    leadsBySource: usePeriodAsPrimary && periodSourceAgg.length ? periodSourceAgg : leadsBySource,
    newLeads: newLeadsRaw.map(enrichLead),
    newLeadsTotal: todayLeads,
    unassignedLeads: unassignedLeadsRaw.map(enrichLead),
    unassignedLeadsTotal,
    recentLeads: recentLeadsRaw.map(enrichLead),
    todayFollowUps: todayFollowUps.map((f) => ({
      _id: f._id,
      customerName: f.lead?.name,
      phone: f.lead?.phone,
      scheduledAt: f.scheduledAt,
      status: f.status,
    })),
    upcomingFollowups,
    salesFunnel,
    monthlyRevenue,
    leadSourceAnalytics: sourceFilteredLeadSourceAnalytics,
    topAgents: topAgents.map((a, i) => ({
      name: agentMap[a._id?.toString()] || 'Unknown',
      conversions: a.conversions,
      revenue: a.revenue,
      rank: i + 1,
    })),
    teamPerformance: topAgents.slice(0, 3).map((a) => ({
      name: agentMap[a._id?.toString()] || 'Unknown',
      assigned: a.conversions * 3,
      converted: a.conversions,
      revenue: a.revenue,
      conversionRate: totalLeads ? Math.round((a.conversions / totalLeads) * 100) : 0,
    })),
    reactivationWidget,
    qualificationWidgets: {
      leadsWithoutBudget,
      leadsWithoutFollowup,
      hotLeads: hotLeadsCount,
      highBudgetLeads: highBudgetLeadsCount,
    },
    activityTimeline: [],
    enterpriseKpis,
    sourceAnalytics,
    executivePerformance,
    emailStats,
    kpiSparklines: {
      totalLeads: monthlyLeadTrend.map((m) => m.leadsGenerated),
      newLeads: monthlyLeadTrend.map((m) => m.leadsGenerated),
      followUps: [pendingFollowups],
      converted: monthlyLeadTrend.map((m) => m.convertedLeads),
      conversionRate: conversionRateTrend.map((m) => m.rate),
      revenue: revenueVsBookings.map((m) => m.revenue),
    },
    report: {
      period: {
        from: isAllTime ? null : periodStart.toISOString(),
        to: periodEnd.toISOString(),
        label: isAllTime
          ? 'All Time'
          : `${periodStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        compareLabel: prevPeriodLabel,
        isAllTime,
        source: source || null,
      },
      generatedAt: new Date().toISOString(),
      kpis: reportKpis,
      statusDistribution,
      leadsBySource: leadsBySourcePeriod,
      monthlyLeadTrend,
      conversionRateTrend,
      revenueVsBookings,
      keyHighlights,
    },
  };
}

async function buildExecutiveDashboard(userId, options = {}) {
  const { branchId } = options;
  const execId = userId;
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const lastMonthEnd = new Date(monthStart.getTime() - 1);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStart.getTime() - 1);

  const leadScope = withBranch({ assignedTo: execId }, branchId);
  const leadIds = await Lead.find(leadScope).distinct('_id');
  const followScope = { $or: [{ assignedTo: execId }, { lead: { $in: leadIds } }] };
  const quoteScope = { $or: [{ createdByExecutive: execId }, { lead: { $in: leadIds } }] };

  const [
    myLeads,
    hotLeads,
    convertedCount,
    todayFollowups,
    quotesSentCount,
    monthlyRevenueAgg,
    recentLeadsRaw,
    myFollowups,
    statusAgg,
    emailStats,
    sourceAgg,
    lastMonthLeads,
    yesterdayFollowups,
    yesterdayHotLeads,
    lastMonthQuotes,
    lastMonthConverted,
    lastMonthRevenueAgg,
  ] = await Promise.all([
    Lead.countDocuments({ ...leadScope, status: { $nin: ['lost', 'booked_from_another_company'] } }),
    Lead.countDocuments({ ...leadScope, isHot: true, status: { $nin: ['converted', 'lost', 'booked_from_another_company'] } }),
    Lead.countDocuments({ ...leadScope, status: 'converted' }),
    FollowUp.find({
      ...followScope,
      scheduledAt: { $gte: todayStart, $lte: todayEnd },
      status: 'pending',
    })
      .populate('lead', 'name destination')
      .sort({ scheduledAt: 1 })
      .limit(20)
      .lean(),
    Quotation.countDocuments({
      ...quoteScope,
      status: { $in: ['sent', 'negotiation', 'approved', 'viewed', 'pending_approval'] },
    }),
    Payment.aggregate([
      { $match: withBranch({ status: { $in: ['paid', 'partial'] }, createdAt: { $gte: monthStart } }, branchId) },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
    Lead.find(leadScope).sort({ createdAt: -1 }).limit(6).lean(),
    FollowUp.find({ ...followScope, status: 'pending' })
      .populate('lead', 'name destination')
      .sort({ scheduledAt: 1 })
      .limit(6)
      .lean(),
    Lead.aggregate([
      { $match: leadScope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    getEmailDashboardStats({ branchId, userId: execId }),
    Lead.aggregate([{ $match: leadScope }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.countDocuments({
      ...leadScope,
      status: { $nin: ['lost', 'booked_from_another_company'] },
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
    }),
    FollowUp.countDocuments({
      ...followScope,
      scheduledAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      status: 'pending',
    }),
    Lead.countDocuments({
      ...leadScope,
      isHot: true,
      status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
      updatedAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
    }),
    Quotation.countDocuments({
      ...quoteScope,
      status: { $in: ['sent', 'negotiation', 'approved', 'viewed', 'pending_approval'] },
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
    }),
    Lead.countDocuments({
      ...leadScope,
      status: 'converted',
      updatedAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
    }),
    Payment.aggregate([
      { $match: withBranch({ status: { $in: ['paid', 'partial'] }, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }, branchId) },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
  ]);

  const statusCounts = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const enrichedRecent = recentLeadsRaw.map(enrichLead);
  const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;
  const lastMonthRevenue = lastMonthRevenueAgg[0]?.total || 0;
  const totalAssigned = Object.values(statusCounts).reduce((s, n) => s + n, 0);
  const monthlyTarget = await getMonthlyTarget(execId);
  const targetStats = buildTargetProgress(monthlyRevenue, monthlyTarget);

  const pipelineOverview = [
    { name: 'New Leads', value: statusCounts.new || 0, color: '#3B82F6' },
    { name: 'Contacted', value: statusCounts.contacted || 0, color: '#8B5CF6' },
    {
      name: 'Follow-up',
      value: (statusCounts.follow_up || 0) + (statusCounts.negotiation || 0),
      color: '#F59E0B',
    },
    { name: 'Hot Leads', value: hotLeads, color: '#F97316' },
    { name: 'Converted', value: convertedCount, color: '#10B981' },
  ].filter((item) => item.value > 0);

  const leadSources = sourceAgg
    .map((s, i) => ({
      name: formatSourceName(s._id),
      value: s.count,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  return {
    emailStats,
    kpis: {
      myLeads,
      todayFollowups: todayFollowups.length,
      hotLeads,
      quotationsSent: quotesSentCount,
      convertedLeads: convertedCount,
      monthlyRevenue,
    },
    kpiTrends: {
      myLeads: { change: pctChange(myLeads, lastMonthLeads), period: 'from last month' },
      todayFollowups: { change: pctChange(todayFollowups.length, yesterdayFollowups), period: 'from yesterday' },
      hotLeads: { change: pctChange(hotLeads, yesterdayHotLeads), period: 'from yesterday' },
      quotationsSent: { change: pctChange(quotesSentCount, lastMonthQuotes), period: 'from last month' },
      convertedLeads: { change: pctChange(convertedCount, lastMonthConverted), period: 'from last month' },
      monthlyRevenue: { change: pctChange(monthlyRevenue, lastMonthRevenue), period: 'from last month' },
    },
    pipelineOverview,
    leadSources,
    todayTasks: todayFollowups.slice(0, 5).map((f) => ({
      _id: f._id,
      title: `Follow up with ${f.lead?.name}`,
      time: f.scheduledAt,
      priority: f.priority || 'medium',
      destination: f.lead?.destination,
    })),
    recentLeads: enrichedRecent.map((l) => ({
      _id: l._id,
      leadId: l.leadId,
      name: l.name,
      destination: l.destination,
      budget: l.budget,
      status: l.status,
      isHot: l.isHot,
    })),
    upcomingFollowups: myFollowups.map((f) => ({
      _id: f._id,
      customer: f.lead?.name,
      destination: f.lead?.destination,
      scheduledAt: f.scheduledAt,
      priority: f.priority || 'medium',
    })),
    conversionProgress: [
      { stage: 'New', count: statusCounts.new || 0, color: '#0EA5E9' },
      { stage: 'Contacted', count: statusCounts.contacted || 0, color: '#8B5CF6' },
      {
        stage: 'Follow-up',
        count: (statusCounts.follow_up || 0) + (statusCounts.negotiation || 0),
        color: '#F59E0B',
      },
      { stage: 'Quotation', count: statusCounts.quotation_sent || 0, color: '#6366F1' },
      { stage: 'Converted', count: convertedCount, color: '#10B981' },
    ],
    target: {
      ...targetStats,
      leadsConverted: convertedCount,
      conversionRate: totalAssigned
        ? Math.round((convertedCount / totalAssigned) * 1000) / 10
        : 0,
      weeklyRevenue: [],
    },
  };
}

async function buildSalesManagerDashboard(options = {}) {
  const { branchId } = options;
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const [
    totalTeamLeads,
    newToday,
    pendingFollowups,
    converted,
    pendingQuotes,
    teamRevenue,
    recentLeadsRaw,
    upcomingFollowups,
    sourceAgg,
  ] = await Promise.all([
    Lead.countDocuments(withBranch({}, branchId)),
    Lead.countDocuments(withBranch({ createdAt: { $gte: todayStart, $lte: todayEnd } }, branchId)),
    FollowUp.countDocuments(withBranch({ status: 'pending' }, branchId)),
    Lead.countDocuments(withBranch({ status: 'converted' }, branchId)),
    Quotation.find(withBranch({ status: { $in: ['sent', 'negotiation', 'pending_approval'] } }, branchId))
      .populate('lead', 'name destination')
      .populate('createdByExecutive', 'name')
      .limit(5)
      .lean(),
    sumConvertedPackageRevenue({ branchId }),
    Lead.find(withBranch({}, branchId))
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    FollowUp.find(withBranch({ status: 'pending' }, branchId))
      .populate('lead', 'name destination')
      .populate('assignedTo', 'name')
      .sort({ scheduledAt: 1 })
      .limit(6)
      .lean(),
    Lead.aggregate([{ $match: withBranch({}, branchId) }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
  ]);

  const recentLeads = recentLeadsRaw.map(enrichLead);
  const conversionRate = totalTeamLeads ? Math.round((converted / totalTeamLeads) * 1000) / 10 : 0;
  const reactivationWidget = await buildReactivationWidget(branchId);

  const executives = await User.find(withBranch({ role: 'sales_executive', status: 'active' }, branchId))
    .select('name email')
    .lean();
  const executivePerformance = await Promise.all(
    executives.map(async (ex) => {
      const [exLeads, exConverted, exRevenue] = await Promise.all([
        Lead.countDocuments({ assignedTo: ex._id }),
        Lead.countDocuments({ assignedTo: ex._id, status: 'converted' }),
        sumConvertedPackageRevenue({ assigneeId: ex._id, branchId }),
      ]);
      return {
        name: ex.name.split(' ')[0],
        fullName: ex.name,
        leads: exLeads,
        revenue: exRevenue,
        conversions: exConverted,
      };
    })
  );

  const colors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626'];

  return {
    kpis: {
      totalTeamLeads,
      newLeadsToday: newToday,
      pendingFollowups,
      convertedLeads: converted,
      teamRevenue,
      conversionRate,
    },
    leadSources: sourceAgg.map((s, i) => ({
      name: s._id || 'Other',
      value: s.count,
      color: colors[i % colors.length],
    })),
    teamRevenueChart: await aggregateConvertedPackageRevenueByMonth({ branchId }),
    executivePerformance,
    monthlyConversion: [],
    recentLeads: recentLeads.map((l) => ({
      _id: l._id,
      leadId: l.leadId,
      name: l.name,
      destination: l.destination,
      budget: l.budget,
      status: l.status,
      executive: l.assignedTo?.name || 'Unassigned',
      source: l.sourceLabel || l.source,
      isHot: l.isHot,
    })),
    pendingApprovals: pendingQuotes.map((q) => ({
      _id: q._id,
      quoteNumber: q.quoteNumber,
      customer: q.lead?.name,
      destination: q.lead?.destination,
      amount: q.pricing?.total,
      margin: q.pricing?.profitMargin,
      executive: q.createdByExecutive?.name || q.lead?.assignedTo?.name,
      status: q.status === 'negotiation' ? 'pending_approval' : q.status,
    })),
    upcomingFollowups: upcomingFollowups.map((f) => ({
      _id: f._id,
      customer: f.lead?.name,
      destination: f.lead?.destination,
      executive: f.assignedTo?.name,
      scheduledAt: f.scheduledAt,
      priority: f.priority || 'medium',
    })),
    teamRanking: executivePerformance.sort((a, b) => b.revenue - a.revenue),
    reactivationWidget,
  };
}

async function buildTeamLeaderDashboard(leaderId, options = {}) {
  const { branchId } = options;
  const execIds = await getExecutiveIdsForLeader(leaderId);
  const squadFilter = withBranch(execIds.length ? { assignedTo: { $in: execIds } } : { assignedTo: null }, branchId);

  const facetCount = (facet, key) => facet?.[key]?.[0]?.n ?? 0;

  const [
    facetResult,
    teamQuotes,
    teamRevenue,
    executives,
    sourceAgg,
    reactivationWidget,
    monthlyTarget,
    teamRevenueTrend,
  ] = await Promise.all([
    Lead.aggregate([
      { $match: squadFilter },
      {
        $facet: {
          total: [{ $count: 'n' }],
          active: [
            { $match: { status: { $nin: ['lost', 'booked_from_another_company'] } } },
            { $count: 'n' },
          ],
          converted: [{ $match: { status: 'converted' } }, { $count: 'n' }],
          new: [{ $match: { status: 'new' } }, { $count: 'n' }],
          contacted: [{ $match: { status: 'contacted' } }, { $count: 'n' }],
          followUp: [
            { $match: { status: { $in: ['follow_up', 'negotiation'] } } },
            { $count: 'n' },
          ],
          quotation: [{ $match: { status: 'quotation_sent' } }, { $count: 'n' }],
          byAssignee: [
            {
              $group: {
                _id: '$assignedTo',
                assignedLeads: { $sum: 1 },
                conversions: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
              },
            },
          ],
          leadIds: [{ $project: { _id: 1 } }],
        },
      },
    ]),
    Quotation.find({ status: 'pending_approval' }).populate('lead', 'assignedTo').lean(),
    sumConvertedPackageRevenue({ assigneeIds: execIds, branchId }),
    User.find({ _id: { $in: execIds } }).select('name email').lean(),
    Lead.aggregate([{ $match: squadFilter }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    buildReactivationWidget(branchId, execIds),
    getMonthlyTarget(leaderId),
    aggregateConvertedPackageRevenueByMonth({ assigneeIds: execIds, branchId }),
  ]);

  const facet = facetResult[0] || {};
  const totalLeads = facetCount(facet, 'total');
  const convertedCount = facetCount(facet, 'converted');
  const activeLeads = facetCount(facet, 'active');
  const leadIds = (facet.leadIds || []).map((l) => l._id);
  const conversionRate = totalLeads
    ? Math.round((convertedCount / totalLeads) * 1000) / 10
    : 0;

  const activeFollowups = await FollowUp.countDocuments({
    status: 'pending',
    $or: [{ assignedTo: { $in: execIds } }, { lead: { $in: leadIds } }],
  });

  const squadQuotes = teamQuotes.filter((q) =>
    execIds.some((id) => q.lead?.assignedTo?.toString?.() === id.toString())
  );

  const assigneeMap = Object.fromEntries((facet.byAssignee || []).map((a) => [String(a._id), a]));
  const executiveRanking = await Promise.all(
    executives.map(async (ex, i) => {
      const stats = assigneeMap[String(ex._id)] || { assignedLeads: 0, conversions: 0 };
      const revenue = await sumConvertedPackageRevenue({ assigneeId: ex._id, branchId });
      return {
        _id: ex._id,
        name: ex.name,
        email: ex.email,
        assignedLeads: stats.assignedLeads,
        conversions: stats.conversions,
        revenue,
        conversionRate: stats.assignedLeads
          ? Math.round((stats.conversions / stats.assignedLeads) * 1000) / 10
          : 0,
        rank: i + 1,
      };
    })
  );

  executiveRanking.sort((a, b) => b.revenue - a.revenue).forEach((e, i) => {
    e.rank = i + 1;
  });

  return {
    kpis: {
      teamLeads: activeLeads,
      activeFollowups,
      teamConversions: convertedCount,
      teamRevenue,
      conversionRate,
      targetAchievement: Math.round((teamRevenue / monthlyTarget) * 100),
    },
    teamRevenueTrend,
    executiveRanking,
    conversionFunnel: [
      { stage: 'New', count: facetCount(facet, 'new'), fill: '#F59E0B' },
      { stage: 'Contacted', count: facetCount(facet, 'contacted'), fill: '#8B5CF6' },
      {
        stage: 'Follow-up',
        count: facetCount(facet, 'followUp'),
        fill: '#6366F1',
      },
      {
        stage: 'Quotation',
        count: facetCount(facet, 'quotation'),
        fill: '#0EA5E9',
      },
      { stage: 'Converted', count: convertedCount, fill: '#10B981' },
    ],
    leadSources: sourceAgg.map((s) => ({
      source: s._id || 'Other',
      count: s.count,
      fill: '#0EA5E9',
    })),
    monthlyTarget,
    teamRevenue,
    pendingApprovalsCount: squadQuotes.length,
    reactivationWidget,
  };
}

async function buildReportsAnalytics(options = {}) {
  const { branchId } = options;
  const [
    totalLeads,
    convertedLeads,
    revenueAgg,
    sourceAgg,
    destAgg,
    statusAgg,
    executives,
    packages,
    monthlyPayments,
  ] = await Promise.all([
    Lead.countDocuments(withBranch({}, branchId)),
    Lead.countDocuments(withBranch({ status: 'converted' }, branchId)),
    Payment.aggregate([
      { $match: withBranch({ status: { $in: ['paid', 'partial'] } }, branchId) },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
    Lead.aggregate([
      { $match: withBranch({}, branchId) },
      {
        $group: {
          _id: '$source',
          leads: { $sum: 1 },
          conversions: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
          },
          revenue: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, '$budget', 0] },
          },
        },
      },
      { $sort: { leads: -1 } },
    ]),
    Lead.aggregate([
      { $match: withBranch({}, branchId) },
      {
        $group: {
          _id: '$destination',
          leads: { $sum: 1 },
          conversions: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
          },
          revenue: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, '$budget', 0] },
          },
        },
      },
      { $sort: { leads: -1 } },
      { $limit: 8 },
    ]),
    Lead.aggregate([{ $match: withBranch({}, branchId) }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.find(withBranch({ role: 'sales_executive', status: 'active' }, branchId)).select('name email').lean(),
    Package.find().select('name').limit(6).lean(),
    Payment.aggregate([
      { $match: withBranch({ status: { $in: ['paid', 'partial'] }, paidAt: { $exists: true } }, branchId) },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          revenue: { $sum: '$paidAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const conversionRate = totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;
  const avgBookingValue = convertedLeads ? Math.round(totalRevenue / convertedLeads) : 0;

  const execStats = await Promise.all(
    executives.map(async (ex) => {
      const [assignedLeads, followUpsDone, conversions, revenue] = await Promise.all([
        Lead.countDocuments({ assignedTo: ex._id }),
        FollowUp.countDocuments({ assignedTo: ex._id, status: 'completed' }),
        Lead.countDocuments({ assignedTo: ex._id, status: 'converted' }),
        sumConvertedPackageRevenue({ assigneeId: ex._id, branchId }),
      ]);
      const rev = revenue;
      return {
        name: ex.name,
        assignedLeads,
        followUpsDone,
        conversions,
        revenue: rev,
        conversionRate: assignedLeads ? Math.round((conversions / assignedLeads) * 1000) / 10 : 0,
      };
    })
  );

  execStats.sort((a, b) => b.revenue - a.revenue).forEach((e, i) => {
    e.rank = i + 1;
  });

  const statusMap = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const funnelStages = [
    { stage: 'Lead Created', key: null },
    { stage: 'Contacted', key: 'contacted' },
    { stage: 'Follow Up', key: 'follow_up' },
    { stage: 'Quotation Sent', key: 'quotation_sent' },
    { stage: 'Negotiation', key: 'negotiation' },
    { stage: 'Converted', key: 'converted' },
  ];

  const funnel = funnelStages.map((f) => {
    let count = totalLeads;
    if (f.key === 'contacted') {
      count =
        (statusMap.contacted || 0) +
        (statusMap.follow_up || 0) +
        (statusMap.quotation_sent || 0) +
        (statusMap.negotiation || 0) +
        convertedLeads;
    } else if (f.key === 'follow_up') {
      count =
        (statusMap.follow_up || 0) + (statusMap.negotiation || 0) + convertedLeads;
    } else if (f.key === 'quotation_sent') {
      count = (statusMap.quotation_sent || 0) + (statusMap.negotiation || 0) + convertedLeads;
    } else if (f.key === 'negotiation') {
      count = (statusMap.negotiation || 0) + convertedLeads;
    } else if (f.key === 'converted') {
      count = convertedLeads;
    }
    return {
      stage: f.stage,
      count,
      pct: totalLeads ? Math.round((count / totalLeads) * 100) : 0,
    };
  });

  const quoteCounts = await Quotation.aggregate([
    { $group: { _id: '$package', sent: { $sum: 1 }, converted: { $sum: 0 } } },
  ]);
  const quoteByPackage = Object.fromEntries(
    quoteCounts.map((q) => [q._id?.toString(), q.sent])
  );
  const reactivationWidget = await buildReactivationWidget(branchId);

  return {
    summary: {
      totalLeads,
      totalConversions: convertedLeads,
      conversionRate,
      totalRevenue,
      avgBookingValue,
      profitMargin: 14.8,
      sparklines: {
        totalLeads: [totalLeads],
        conversions: [convertedLeads],
        conversionRate: [conversionRate],
        revenue: [totalRevenue],
        avgBooking: [avgBookingValue],
        profitMargin: [14.8],
      },
    },
    leadSources: sourceAgg.map((s) => ({
      source: SOURCE_LABELS[s._id] || s._id || 'Other',
      leads: s.leads,
      conversions: s.conversions,
      revenue: s.revenue,
      costPerLead: 0,
      roi: s.leads && s.conversions ? Math.round((s.conversions / s.leads) * 100) : 0,
    })),
    executives: execStats,
    destinations: destAgg.map((d) => ({
      destination: d._id,
      leads: d.leads,
      conversions: d.conversions,
      revenue: d.revenue,
    })),
    packages: packages.map((p) => ({
      name: p.name,
      views: 0,
      quotationsSent: quoteByPackage[p._id?.toString()] || 0,
      conversions: 0,
      revenue: 0,
    })),
    revenue: {
      daily: [],
      weekly: [],
      monthly: monthlyPayments.map((r) => ({
        label: MONTH_LABELS[(r._id.month || 1) - 1],
        revenue: r.revenue,
      })),
      yearly: [],
    },
    funnel,
    forecast: {
      expectedRevenue: Math.round(totalRevenue * 0.4),
      expectedConversions: Math.max(1, Math.round(convertedLeads * 0.4)),
      upcomingBookings: [],
    },
    reactivationWidget,
  };
}

async function buildTeamPerformance(options = {}) {
  const { branchId } = options;
  const executives = await User.find(withBranch({ role: 'sales_executive', status: 'active' }, branchId)).lean();
  const members = await Promise.all(
    executives.map(async (ex) => {
      const [assigned, converted, followUps, revenue] = await Promise.all([
        Lead.countDocuments({ assignedTo: ex._id }),
        Lead.countDocuments({ assignedTo: ex._id, status: 'converted' }),
        FollowUp.countDocuments({ assignedTo: ex._id, status: 'pending' }),
        sumConvertedPackageRevenue({ assigneeId: ex._id, branchId }),
      ]);
      return {
        name: ex.name,
        assigned,
        converted,
        conversions: converted,
        followUps,
        revenue,
        conversionRate: assigned ? Math.round((converted / assigned) * 100) : 0,
        rank: 0,
      };
    })
  );

  members.sort((a, b) => b.revenue - a.revenue);
  members.forEach((m, i) => {
    m.rank = i + 1;
  });

  return {
    members,
    teamRevenue: members.reduce((sum, m) => sum + m.revenue, 0),
    teamConversions: members.reduce((sum, m) => sum + m.conversions, 0),
    teamFollowUps: await FollowUp.countDocuments({ status: 'pending' }),
  };
}

module.exports = {
  buildAdminDashboard,
  buildExecutiveDashboard,
  buildSalesManagerDashboard,
  buildTeamLeaderDashboard,
  buildTeamPerformance,
  buildReportsAnalytics,
};
