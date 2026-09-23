const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const Payment = require('../models/Payment');
const Package = require('../models/Package');
const User = require('../models/User');
const Team = require('../models/Team');
const Booking = require('../models/Booking');
const LeadActivity = require('../models/LeadActivity');
const { startOfDay, endOfDay, enrichLead, buildDueTodayFollowUpFilter } = require('../utils/queryHelpers');
const {
  sumConvertedPackageRevenue,
  aggregateConvertedPackageRevenueByMonth,
} = require('../utils/convertedPackageRevenue');
const { getExecutiveIdsForLeader } = require('./teamScopeService');
const { getEnterpriseKpis, getSourceAnalytics, getExecutivePerformance } = require('./leadAnalyticsService');
const { getEmailDashboardStats } = require('./emailStatsService');
const { getMonthlyTargets, buildTargetProgress } = require('./salesTargetService');
const { withBranch } = require('../utils/branchScope');
const { sumMarketingSpendInRange } = require('./marketingSpendService');
const { rollupCityStatsIntoStates, resolveDestinationGroupValues } = require('../utils/destinationHierarchy');
const { attachPhoneVisibility, maskLeadPhone } = require('../utils/leadPhoneVisibility');

/** Single source of truth for the "Low Follow-up Executives" cutoff — used by both the
 * Action Required KPI (buildAdminDashboard) and the /team performance drill-down
 * (buildTeamPerformance), so the two never diverge. */
const LOW_FOLLOWUP_COMPLETION_THRESHOLD = 40;

/**
 * Apply the SAME call-gated phone visibility rule (see utils/leadPhoneVisibility.js) to a batch
 * of lean lead docs before they leave a dashboard widget — one CallNote aggregation for the
 * whole batch, never per-lead. Admin/Sales-Executive dashboards must not leak a raw phone number
 * any earlier/differently than the Leads List / Lead Detail APIs already gate it.
 */
async function maskDashboardLeads(leads = []) {
  if (!leads.length) return leads;
  await attachPhoneVisibility(leads);
  // Mutate each lead in place (rather than returning a new masked array) — these lean docs are
  // `const`-destructured from a single big Promise.all and get passed through further
  // .map(enrichLead)/manual-shape calls afterward by the SAME array reference, so the mask must
  // be visible to those later reads, not just to whatever this function itself returns.
  leads.forEach((lead) => {
    const masked = maskLeadPhone(lead);
    if (masked !== lead) Object.assign(lead, masked);
  });
  return leads;
}

/**
 * Same gate, applied to the populated `.lead` sub-document of a list of parent docs (e.g.
 * FollowUp.find(...).populate('lead', '...')) instead of to the lead docs themselves. The
 * populate select must include `assignedTo` — attachPhoneVisibility uses it as the CallNote
 * lookup key — same requirement as any other lead projection this gate is applied to.
 */
async function maskDashboardLeadRefs(items = [], leadKey = 'lead') {
  const leads = items.map((item) => item[leadKey]).filter(Boolean);
  if (!leads.length) return items;
  await attachPhoneVisibility(leads);
  items.forEach((item) => {
    if (item[leadKey]) item[leadKey] = maskLeadPhone(item[leadKey]);
  });
  return items;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASHBOARD_NEW_LEADS_LIMIT = 5;

const INTERESTED_STATUSES = [
  'contacted',
  'working_progress',
  'qualified',
  'quotation_sent',
  'follow_up',
  'reactivated',
];
const LOST_STATUSES = ['lost', 'booked_from_another_company'];
/**
 * Connected = only status `contacted` (call picked).
 * WIP / qualified / quote / follow-up / converted are separate KPIs — must match list filter status=contacted.
 */
const CONNECTED_STATUSES = ['contacted'];
const QUALIFIED_FUNNEL_STATUSES = [
  'qualified',
  'quotation_sent',
  'follow_up',
  'negotiation',
  'converted',
];
const QUOTATION_FUNNEL_STATUSES = ['quotation_sent', 'follow_up', 'negotiation', 'converted'];

function sumStatusCounts(statusCounts = {}, keys = []) {
  return keys.reduce((sum, key) => sum + (statusCounts[key] || 0), 0);
}

function resolveDestinationPeriod(period = 'all') {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const yesterdayStart = startOfDay(new Date(todayStart.getTime() - 24 * 60 * 60 * 1000));
  const yesterdayEnd = endOfDay(new Date(todayStart.getTime() - 1));
  const weekStart = startOfDay(new Date(todayStart));
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  const sevenDaysStart = startOfDay(new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000));
  const monthStart = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), 1));

  switch (String(period || 'all').toLowerCase()) {
    case 'today':
      return { start: todayStart, end: todayEnd };
    case 'yesterday':
      return { start: yesterdayStart, end: yesterdayEnd };
    case '7d':
    case '7days':
    case 'last_7_days':
      return { start: sevenDaysStart, end: todayEnd };
    case 'week':
      return { start: weekStart, end: todayEnd };
    case 'month':
      return { start: monthStart, end: todayEnd };
    case 'all':
    case 'all_time':
    default:
      return { start: null, end: null };
  }
}

async function buildDestinationWiseStats(leadScope, period = 'all', rangeOverride = null) {
  const resolved = rangeOverride?.start && rangeOverride?.end
    ? { start: rangeOverride.start, end: rangeOverride.end }
    : resolveDestinationPeriod(period);
  const { start, end } = resolved;
  const match = { ...leadScope };
  if (start && end) {
    match.createdAt = { $gte: start, $lte: end };
  }

  const rows = await Lead.aggregate([
    { $match: match },
    {
      $addFields: {
        destinationKey: {
          $toLower: {
            $trim: { input: { $ifNull: ['$destination', 'Not specified'] } },
          },
        },
        destinationName: {
          $cond: [
            { $or: [{ $eq: [{ $ifNull: ['$destination', ''] }, ''] }, { $eq: ['$destination', null] }] },
            'Not specified',
            '$destination',
          ],
        },
      },
    },
    {
      $group: {
        _id: '$destinationKey',
        destination: { $first: '$destinationName' },
        total: { $sum: 1 },
        converted: {
          $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
        },
        active: {
          $sum: {
            $cond: [
              { $in: ['$status', ['lost', 'booked_from_another_company']] },
              0,
              1,
            ],
          },
        },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const mapped = rows.map((row) => ({
    destination: row.destination,
    total: row.total,
    converted: row.converted,
    active: row.active,
    conversionRate: row.total ? Math.round((row.converted / row.total) * 1000) / 10 : 0,
  }));

  // State rows include conversions/leads from their cities (Manali → Himachal Pradesh)
  return rollupCityStatsIntoStates(mapped, {
    nameField: 'destination',
    metricFields: ['total', 'converted', 'active'],
    rateConfig: { field: 'conversionRate', numerator: 'converted', denominator: 'total' },
    sortField: 'total',
    limit: 25,
  });
}

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

/** Trend months from July of the season year through endDate (Jul → current). */
function buildMonthBucketsFromJuly(endDate = new Date()) {
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  let startYear = end.getFullYear();
  // Before July → use previous year's July (season still running into H1)
  if (end.getMonth() < 6) startYear -= 1;
  const start = new Date(startYear, 6, 1); // July = month index 6
  const buckets = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    buckets.push({
      key: monthKey(cursor.getFullYear(), cursor.getMonth() + 1),
      label: MONTH_LABELS[cursor.getMonth()],
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      start: startOfDay(cursor),
      end: endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
    });
    cursor.setMonth(cursor.getMonth() + 1);
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
  const connected = sumStatusCounts(statusCounts, CONNECTED_STATUSES);
  const qualified = sumStatusCounts(statusCounts, QUALIFIED_FUNNEL_STATUSES);
  const quotations = sumStatusCounts(statusCounts, QUOTATION_FUNNEL_STATUSES);
  const lost = LOST_STATUSES.reduce((s, k) => s + (statusCounts[k] || 0), 0);
  const conversions = statusCounts.converted || 0;
  const workingProgress = statusCounts.working_progress || 0;
  return {
    fresh,
    followUpPending,
    interested,
    negotiation,
    connected,
    qualified,
    workingProgress,
    quotations,
    lost,
    conversions,
  };
}

/** Current Warm / Hot / Cold options — matches lead list statusReason keys */
const FALLBACK_WARM_STATUS_KEYS = [
  'discussed_package',
  'requested_callback',
  'cnp_same_day',
  'price_negotiation',
];
const FALLBACK_HOT_STATUS_KEYS = ['ready_to_book'];
const FALLBACK_COLD_STATUS_KEYS = [
  'booked_elsewhere',
  'language_barrier',
  'not_interested',
  'invalid_number',
  'budget_issues',
  'budget_issue',
];

async function resolveStatusOptionKeys() {
  try {
    const { getOptionKeysByCategory } = require('./leadStatusConfigService');
    const keys = await getOptionKeysByCategory({ enabledOnly: true });
    return {
      warm: keys.warm.length ? keys.warm : FALLBACK_WARM_STATUS_KEYS,
      hot: keys.hot.length ? keys.hot : FALLBACK_HOT_STATUS_KEYS,
      cold: keys.cold.length ? keys.cold : FALLBACK_COLD_STATUS_KEYS,
    };
  } catch {
    return {
      warm: FALLBACK_WARM_STATUS_KEYS,
      hot: FALLBACK_HOT_STATUS_KEYS,
      cold: FALLBACK_COLD_STATUS_KEYS,
    };
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function statusReasonMatch(keys) {
  const alts = [...keys].map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  return {
    statusReason: {
      $regex: `(^|not_connected:)(${alts})($|[\\s:.—–-])`,
      $options: 'i',
    },
  };
}

async function countLeadsByStatusOption(branchId, keys, extraMatch = {}) {
  return Lead.countDocuments(
    activeLeadScope({ ...extraMatch, ...statusReasonMatch(keys) }, branchId)
  );
}

/**
 * Mutually exclusive status slices — every lead counted once.
 * Sum of values === total leads in the selected period.
 */
function buildExclusiveStatusDistribution(statusCounts = {}) {
  const stages = [
    { name: 'New', key: 'new', color: '#64748B', pick: (c) => c.new || 0 },
    { name: 'Contacted', key: 'contacted', color: '#6366F1', pick: (c) => c.contacted || 0 },
    { name: 'Working', key: 'working', color: '#F97316', pick: (c) => c.working_progress || 0 },
    { name: 'Qualified', key: 'qualified', color: '#10B981', pick: (c) => c.qualified || 0 },
    { name: 'Quotation', key: 'quotation', color: '#3B82F6', pick: (c) => c.quotation_sent || 0 },
    { name: 'Follow-up', key: 'follow_up', color: '#8B5CF6', pick: (c) => c.follow_up || 0 },
    { name: 'Negotiation', key: 'negotiation', color: '#F59E0B', pick: (c) => c.negotiation || 0 },
    { name: 'Reactivated', key: 'reactivated', color: '#14B8A6', pick: (c) => c.reactivated || 0 },
    { name: 'Booking', key: 'converted', color: '#059669', pick: (c) => c.converted || 0 },
    {
      name: 'Lost',
      key: 'lost',
      color: '#EF4444',
      pick: (c) => (c.lost || 0) + (c.booked_from_another_company || 0),
    },
  ];

  const rows = stages.map((s) => ({
    name: s.name,
    key: s.key,
    color: s.color,
    value: Math.max(0, Number(s.pick(statusCounts)) || 0),
  }));
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const interested =
    (statusCounts.contacted || 0) +
    (statusCounts.working_progress || 0) +
    (statusCounts.qualified || 0) +
    (statusCounts.follow_up || 0) +
    (statusCounts.quotation_sent || 0) +
    (statusCounts.negotiation || 0);

  return {
    items: rows.map((r) => ({
      ...r,
      pct: total ? Math.round((r.value / total) * 1000) / 10 : 0,
    })),
    summary: {
      total,
      arrived: total,
      fresh: statusCounts.new || 0,
      connected: sumStatusCounts(statusCounts, CONNECTED_STATUSES),
      qualified: sumStatusCounts(statusCounts, QUALIFIED_FUNNEL_STATUSES),
      interested,
      converted: statusCounts.converted || 0,
      lost: (statusCounts.lost || 0) + (statusCounts.booked_from_another_company || 0),
      followUp: statusCounts.follow_up || 0,
      quotation: statusCounts.quotation_sent || 0,
      negotiation: statusCounts.negotiation || 0,
    },
  };
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
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw_call: 'DPW CALL',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
  dpw2_call: 'DPW2 CALL',
  referral: 'Referral',
  call_lead: 'Call Lead',
  organic: 'Organic',
  website: 'DPW',
  whatsapp: 'DPW2 WA',
  social: 'DPW2',
  phone: 'Call Lead',
  other: 'Organic',
  google_ads: 'DPW',
  facebook_ads: 'DPW2',
  instagram: 'DPW2',
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

/**
 * Raw per-destination-text lead counts (name-normalized to 'Not specified' when empty, grouped
 * case-insensitively) for the given lead scope — the one place this counting logic is defined.
 * Callers pass the result through rollupCityStatsIntoStates (utils/destinationHierarchy.js) for
 * the city→state collapse + unknown/Other handling. Used by both buildAdminDashboard's Top-12
 * card and buildAllDestinations' complete breakdown — never duplicated between them.
 */
async function aggregateDestinationCounts(scope) {
  return Lead.aggregate([
    { $match: scope },
    {
      $project: {
        destinationRaw: { $trim: { input: { $ifNull: ['$destination', ''] } } },
        status: 1,
      },
    },
    {
      $addFields: {
        destination: {
          $cond: [
            { $or: [{ $eq: ['$destinationRaw', ''] }, { $eq: ['$destinationRaw', null] }] },
            'Not specified',
            '$destinationRaw',
          ],
        },
      },
    },
    {
      $group: {
        _id: { $toLower: '$destination' },
        name: { $first: '$destination' },
        queries: { $sum: 1 },
        conversions: {
          $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
        },
      },
    },
    { $sort: { queries: -1, name: 1 } },
  ]);
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
  const monthBuckets = buildMonthBucketsFromJuly(periodEnd);
  const trendStart = monthBuckets[0].start;

  const yesterdayStart = startOfDay(new Date(todayStart.getTime() - 24 * 60 * 60 * 1000));
  const yesterdayEnd = endOfDay(new Date(todayStart.getTime() - 1));

  const [
    totalLeads,
    todayLeads,
    yesterdayLeads,
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
    periodHotCount,
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
    monthlyConnectedAgg,
    monthlyBookingAgg,
    monthlyPaymentAgg,
    topDestinationAgg,
  ] = await Promise.all([
    Lead.countDocuments(activeLeadScope({}, branchId)),
    Lead.countDocuments(activeLeadScope({ createdAt: { $gte: todayStart, $lte: todayEnd } }, branchId)),
    Lead.countDocuments(
      activeLeadScope({ createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }, branchId)
    ),
    Lead.countDocuments(activeLeadScope({ status: 'converted' }, branchId)),
    Lead.countDocuments(activeLeadScope({ status: { $in: LOST_STATUSES } }, branchId)),
    FollowUp.countDocuments(withBranch({ status: 'pending' }, branchId)),
    FollowUp.countDocuments({
      ...(branchId ? { branchId } : {}),
      $or: [{ status: 'missed' }, { status: 'pending', scheduledAt: { $lt: todayStart } }],
    }),
    Lead.aggregate([{ $match: activeLeadScope({}, branchId) }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: activeLeadScope({}, branchId) },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          connected: {
            $sum: {
              $cond: [{ $in: ['$status', CONNECTED_STATUSES] }, 1, 0],
            },
          },
          bookings: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
          },
        },
      },
    ]),
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
      .populate('lead', 'name phone destination assignedTo')
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
    Lead.countDocuments({
      ...periodLeadScope,
      $or: [{ isHot: true }, { leadScore: 'hot' }],
    }),
    Lead.countDocuments(prevLeadScope),
    Lead.aggregate([{ $match: periodLeadScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: prevLeadScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    sumRevenueInRange(branchId, periodStart, periodEnd),
    sumRevenueInRange(branchId, prevStart, prevEnd),
    Lead.aggregate([
      { $match: isAllTime ? liveLeadScope : periodLeadScope },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          connected: {
            $sum: {
              $cond: [{ $in: ['$status', CONNECTED_STATUSES] }, 1, 0],
            },
          },
          bookings: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
          },
        },
      },
    ]),
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
    Lead.aggregate([
      {
        $match: activeLeadScope(
          {
            status: { $in: CONNECTED_STATUSES },
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
    aggregateDestinationCounts(isAllTime ? liveLeadScope : periodLeadScope),
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
    getExecutivePerformance(branchId, { dateFrom, dateTo, source }),
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
  const connectedMap = Object.fromEntries(
    monthlyConnectedAgg.map((r) => [monthKey(r._id.year, r._id.month), r.count])
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
    connectedLeads: connectedMap[b.key] || 0,
    convertedLeads: convertedMap[b.key] || 0,
  }));

  const dailyTrendStart = startOfDay(new Date(periodEnd.getTime() - 29 * 24 * 60 * 60 * 1000));
  const dailyLeadAgg = await Lead.aggregate([
    {
      $match: activeLeadScope(
        { createdAt: { $gte: dailyTrendStart, $lte: periodEnd }, ...sourceFilter },
        branchId
      ),
    },
    {
      $group: {
        _id: {
          y: { $year: '$createdAt' },
          m: { $month: '$createdAt' },
          d: { $dayOfMonth: '$createdAt' },
        },
        leadsGenerated: { $sum: 1 },
        connectedLeads: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    'contacted',
                    'working_progress',
                    'qualified',
                    'quotation_sent',
                    'follow_up',
                    'negotiation',
                    'converted',
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        qualifiedLeads: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  ['qualified', 'quotation_sent', 'follow_up', 'negotiation', 'converted'],
                ],
              },
              1,
              0,
            ],
          },
        },
        quotationLeads: {
          $sum: {
            $cond: [
              { $in: ['$status', ['quotation_sent', 'follow_up', 'negotiation', 'converted']] },
              1,
              0,
            ],
          },
        },
        convertedLeads: {
          $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
        },
      },
    },
  ]);
  const dailyMap = Object.fromEntries(
    dailyLeadAgg.map((r) => {
      const key = `${r._id.y}-${String(r._id.m).padStart(2, '0')}-${String(r._id.d).padStart(2, '0')}`;
      return [key, r];
    })
  );
  const dailyLeadTrend = [];
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(dailyTrendStart.getTime() + i * 24 * 60 * 60 * 1000);
    if (day > periodEnd) break;
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const row = dailyMap[key];
    dailyLeadTrend.push({
      label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      date: key,
      leadsGenerated: row?.leadsGenerated || 0,
      connectedLeads: row?.connectedLeads || 0,
      qualifiedLeads: row?.qualifiedLeads || 0,
      quotationLeads: row?.quotationLeads || 0,
      convertedLeads: row?.convertedLeads || 0,
    });
  }

  const conversionRateTrend = monthBuckets.map((b) => {
    const leads = leadMap[b.key] || 0;
    const converted = convertedMap[b.key] || 0;
    const connected = connectedMap[b.key] || 0;
    return {
      label: b.label,
      month: b.label,
      leads,
      connected,
      converted,
      rate: leads ? Math.round((converted / leads) * 1000) / 10 : 0,
    };
  });

  const revenueVsBookings = monthBuckets.map((b) => ({
    label: b.label,
    month: b.label,
    bookings: bookingMap[b.key] || 0,
    revenue: paymentMap[b.key] || 0,
  }));

  const topDestinations = await rollupCityStatsIntoStates(
    topDestinationAgg.map((row) => ({
      name: row.name,
      queries: row.queries || 0,
      conversions: row.conversions || 0,
      conversionRate: row.queries
        ? Math.round(((row.conversions || 0) / row.queries) * 1000) / 10
        : 0,
    })),
    {
      nameField: 'name',
      metricFields: ['queries', 'conversions'],
      rateConfig: { field: 'conversionRate', numerator: 'conversions', denominator: 'queries' },
      sortField: 'queries',
      limit: 12,
      groupUnknownAs: 'Other',
    }
  );

  const periodSourceTotal = periodSourceAgg.reduce((s, r) => s + r.count, 0) || 1;
  const leadsBySourcePeriod = periodSourceAgg
    .map((s, i) => ({
      name: formatSourceName(s._id),
      key: s._id || 'other',
      value: s.count,
      connected: Number(s.connected || 0),
      bookings: Number(s.bookings || 0),
      pct: Math.round((s.count / periodSourceTotal) * 1000) / 10,
      connectedPct:
        s.count > 0 ? Math.round((Number(s.connected || 0) / s.count) * 1000) / 10 : 0,
      convPct:
        s.count > 0 ? Math.round((Number(s.bookings || 0) / s.count) * 1000) / 10 : 0,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Status distribution = exclusive pipeline slices for the selected period (sum === arrived).
  // All-time uses live statuses; filtered period uses leads created in that range.
  const distributionCounts = isAllTime ? statusCounts : periodStatusCounts;
  const distributionBuilt = buildExclusiveStatusDistribution(distributionCounts);
  const statusDistribution = distributionBuilt.items;
  const statusDistributionSummary = {
    ...distributionBuilt.summary,
    hot: isAllTime ? hotLeadsCount : periodHotCount,
    periodLabel: isAllTime
      ? 'All Time'
      : `${periodStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${periodEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
  };

  const distributionBuckets = isAllTime ? mapStatusBucket(statusCounts) : periodBuckets;
  const valueBuckets = { ...distributionBuckets };
  const changeBuckets = isAllTime ? momBuckets : periodBuckets;
  const changeTotal = isAllTime ? momTotalLeads : periodTotalLeads;
  const changeRevenue = isAllTime ? momRevenue : periodRevenue;
  const changeConvRate = isAllTime ? momConversionRate : periodConversionRate;

  const withValue = (meta, value) => ({ ...meta, value });
  const sameDayPrev = startOfDay(prevStart).getTime() === startOfDay(prevEnd).getTime();
  const prevPeriodLabel = sameDayPrev
    ? prevStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : `${prevStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${prevEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  // Warm / Hot / Cold — current statusReason options (period-scoped for strip; filters apply)
  const periodCreated = { createdAt: { $gte: periodStart, $lte: periodEnd }, ...sourceFilter };
  const prevCreated = { createdAt: { $gte: prevStart, $lte: prevEnd }, ...sourceFilter };
  const statusOptionKeys = await resolveStatusOptionKeys();
  const [
    warmCount,
    hotCount,
    coldCount,
    prevWarmCount,
    prevHotCount,
    prevColdCount,
  ] = await Promise.all([
    countLeadsByStatusOption(branchId, statusOptionKeys.warm, isAllTime ? sourceFilter : periodCreated),
    countLeadsByStatusOption(branchId, statusOptionKeys.hot, isAllTime ? sourceFilter : periodCreated),
    countLeadsByStatusOption(branchId, statusOptionKeys.cold, isAllTime ? sourceFilter : periodCreated),
    countLeadsByStatusOption(branchId, statusOptionKeys.warm, prevCreated),
    countLeadsByStatusOption(branchId, statusOptionKeys.hot, prevCreated),
    countLeadsByStatusOption(branchId, statusOptionKeys.cold, prevCreated),
  ]);

  // Bookings / Revenue / Conv. Rate — the top KPI cards must follow the same selected dashboard
  // period as Leads/Warm/Hot/Cold (same valueBuckets/changeBuckets vs prevBuckets pattern used
  // above for qualified/quotations/lostLeads). All-time totals are kept separately below only for
  // the sidebar "Key Highlights" widget (report.keyHighlights), which intentionally always
  // summarizes lifetime performance.
  const allTimeBookings = convertedLeads;
  const allTimeRevenue = revenue;
  const allTimeConversionRate = conversionRate;
  const kpiRevenue = isAllTime ? allTimeRevenue : periodRevenue;
  const kpiConversionRate = isAllTime ? allTimeConversionRate : periodConversionRate;

  const reportKpis = {
    totalLeads: withValue(changeMeta(changeTotal, prevTotalLeads), periodTotalLeads),
    // Fresh = leads created today (vs yesterday)
    freshLeads: withValue(changeMeta(todayLeads, yesterdayLeads), todayLeads),
    followUpPending: withValue(
      changeMeta(changeBuckets.followUpPending, prevBuckets.followUpPending),
      valueBuckets.followUpPending
    ),
    interested: withValue(changeMeta(changeBuckets.interested, prevBuckets.interested), valueBuckets.interested),
    // Legacy keys kept for older clients
    connected: withValue(changeMeta(warmCount, prevWarmCount), warmCount),
    qualified: withValue(changeMeta(changeBuckets.qualified, prevBuckets.qualified), valueBuckets.qualified),
    workingProgress: withValue(changeMeta(hotCount, prevHotCount), hotCount),
    warm: withValue(changeMeta(warmCount, prevWarmCount), warmCount),
    hot: withValue(changeMeta(hotCount, prevHotCount), hotCount),
    cold: withValue(changeMeta(coldCount, prevColdCount), coldCount),
    quotations: withValue(changeMeta(changeBuckets.quotations, prevBuckets.quotations), valueBuckets.quotations),
    bookings: withValue(changeMeta(changeBuckets.conversions, prevBuckets.conversions), valueBuckets.conversions),
    lostLeads: withValue(changeMeta(changeBuckets.lost, prevBuckets.lost), valueBuckets.lost),
    conversions: withValue(changeMeta(changeBuckets.conversions, prevBuckets.conversions), valueBuckets.conversions),
    revenue: withValue(changeMeta(changeRevenue, prevRevenue), kpiRevenue),
    conversionRate: withValue(changeMeta(changeConvRate, prevConversionRate), kpiConversionRate),
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
    conversionRate: allTimeConversionRate,
    revenueGenerated: allTimeRevenue,
  };

  const salesFunnel = [
    { stage: 'Leads', count: isAllTime ? totalLeads : periodTotalLeads },
    { stage: 'Warm', count: warmCount },
    { stage: 'Hot', count: hotCount },
    { stage: 'Cold', count: coldCount },
    { stage: 'Bookings', count: valueBuckets.conversions },
  ];

  const followUpsDueToday = await FollowUp.countDocuments(
    withBranch(buildDueTodayFollowUpFilter(), branchId)
  );
  // "24+ hrs" cutoff — same rolling-window convention used elsewhere for hour-based
  // aging (e.g. leadConnectedProgressService.js CONNECTED_TO_WIP_HOURS), not a calendar-day
  // boundary. Untouched semantics (firstContactAt) are unchanged — this only adds the missing age gate.
  const untouchedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const leadsUntouched = await Lead.countDocuments(
    activeLeadScope(
      {
        status: 'new',
        $or: [{ firstContactAt: null }, { firstContactAt: { $exists: false } }],
        createdAt: { $lte: untouchedCutoff },
      },
      branchId
    )
  );
  // Customer-facing, not-yet-decided quotations only. 'pending_approval' is an internal
  // TL/manager approval-workflow status (the customer never saw it) — excluded per the Phase 2
  // definition. 'draft'/'approved'/'rejected' are already excluded (not in the $in list); no
  // 'expired'/'cancelled' status exists on this model (see backend/src/models/Quotation.js).
  const quotationsAwaiting = await Quotation.countDocuments(
    withBranch({ status: { $in: ['sent', 'viewed', 'negotiation'] } }, branchId)
  );

  let pendingPaymentCount = 0;
  try {
    // Exclude cancelled + refund_completed bookings — both are terminal/exited states
    // (same treatment as the archived/cancelled exclusion already used for the "upcoming trips"
    // scope in operationsService.js). refund_pending is intentionally kept: elsewhere in this
    // codebase (operationsService.js "active" booking scope) it is still treated as an open,
    // in-progress state, not a settled one.
    pendingPaymentCount = await Booking.countDocuments(
      withBranch(
        { paymentStatus: { $in: ['pending', 'partial'] }, status: { $nin: ['cancelled', 'refund_completed'] } },
        branchId
      )
    );
  } catch {
    pendingPaymentCount = 0;
  }

  const lowFollowUpExecutives = (executivePerformance?.executives || []).filter(
    (ex) =>
      Number(ex.followUpCompletion || 0) < LOW_FOLLOWUP_COMPLETION_THRESHOLD &&
      Number(ex.assigned || 0) > 0
  ).length;

  // Carry the same dashboard period into the /team drill-down so it evaluates the identical
  // executive population the KPI just counted (see buildTeamPerformance, which reuses
  // getExecutivePerformance — the same calculation, not a second one).
  const teamPerfParams = new URLSearchParams({ tab: 'performance' });
  if (dateFrom) teamPerfParams.set('dateFrom', dateFrom);
  if (dateTo) teamPerfParams.set('dateTo', dateTo);
  if (source) teamPerfParams.set('source', source);

  const actionRequired = [
    {
      key: 'followups_due',
      label: 'Follow-ups Due Today',
      count: followUpsDueToday,
      link: '/followups?kpiTab=today&status=pending',
      tone: 'violet',
    },
    { key: 'untouched', label: 'Leads Untouched', count: leadsUntouched, link: '/leads/inbox/new', tone: 'amber' },
    {
      key: 'quotes_awaiting',
      label: 'Quotations Awaiting Response',
      count: quotationsAwaiting,
      link: '/quotations?status=sent,viewed,negotiation',
      tone: 'blue',
    },
    {
      key: 'pending_payment',
      label: 'Bookings Pending Payment',
      count: pendingPaymentCount,
      link: '/operations-manager/bookings/unpaid',
      tone: 'rose',
    },
    {
      key: 'low_followup_execs',
      label: 'Low Follow-up Executives',
      count: lowFollowUpExecutives,
      link: `/team?${teamPerfParams.toString()}`,
      tone: 'orange',
    },
  ];

  const todayRevenue = await sumRevenueInRange(branchId, todayStart, todayEnd);
  const yesterdayRevenue = await sumRevenueInRange(branchId, yesterdayStart, yesterdayEnd);
  const todayMarketingSpend = await sumMarketingSpendInRange(branchId, todayStart, todayEnd);
  const yesterdayMarketingSpend = await sumMarketingSpendInRange(branchId, yesterdayStart, yesterdayEnd);
  const monthStartFin = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), 1));
  const lastMonthStartFin = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1));
  const lastMonthEndFin = endOfDay(new Date(monthStartFin.getTime() - 1));
  const monthRevenue = await sumRevenueInRange(branchId, monthStartFin, todayEnd);
  const lastMonthRevenue = await sumRevenueInRange(branchId, lastMonthStartFin, lastMonthEndFin);
  const grossMarginRate = 0.16;
  const financials = {
    marketingSpend: withValue(
      changeMeta(todayMarketingSpend, yesterdayMarketingSpend),
      todayMarketingSpend
    ),
    sales: withValue(changeMeta(todayRevenue, yesterdayRevenue), todayRevenue),
    grossMargin: withValue(
      changeMeta(
        Math.round(todayRevenue * grossMarginRate),
        Math.round(yesterdayRevenue * grossMarginRate)
      ),
      Math.round(todayRevenue * grossMarginRate)
    ),
    roi: withValue(
      changeMeta(
        lastMonthRevenue ? Math.round((monthRevenue / Math.max(lastMonthRevenue, 1)) * 100) / 100 : 0,
        1
      ),
      lastMonthRevenue ? Math.round((monthRevenue / Math.max(lastMonthRevenue, 1)) * 100) / 100 : 0
    ),
  };

  const todayFollowUps = await FollowUp.find(withBranch({
    scheduledAt: { $gte: todayStart, $lte: todayEnd },
  }, branchId))
    .populate('lead', 'name phone assignedTo')
    .sort({ scheduledAt: 1 })
    .limit(10)
    .lean();
  // Same call-gated phone rule as the Leads List/Detail APIs — a lead surfaced in a dashboard
  // widget must not show its real number any earlier than anywhere else (see
  // utils/leadPhoneVisibility.js). Batched: one CallNote aggregation for this whole widget.
  await maskDashboardLeadRefs(todayFollowUps);
  await maskDashboardLeadRefs(upcomingFollowups);
  await maskDashboardLeads(newLeadsRaw);
  await maskDashboardLeads(unassignedLeadsRaw);
  await maskDashboardLeads(recentLeadsRaw);

  const sourceFilteredLeadSourceAnalytics = (periodSourceAgg.length ? periodSourceAgg : leadsBySource).map((s) => ({
    name: s._id || 'Unknown',
    value: s.count,
    connected: Number(s.connected || 0),
    bookings: Number(s.bookings || 0),
    pct: (periodSourceAgg.length ? periodSourceTotal : totalLeads)
      ? Math.round((s.count / (periodSourceAgg.length ? periodSourceTotal : totalLeads || 1)) * 100)
      : 0,
  }));

  const usePeriodAsPrimary = Boolean(dateFrom || dateTo);
  const primaryTotalLeads = usePeriodAsPrimary ? periodTotalLeads : totalLeads;
  // Bookings / Revenue / Conv. Rate stay all-time even when a period filter is applied
  const primaryConverted = convertedLeads;
  const primaryLost = usePeriodAsPrimary ? periodBuckets.lost : lostLeads;
  const primaryConversionRate = conversionRate;
  const primaryRevenue = revenue;

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
    workingProgress: usePeriodAsPrimary ? hotCount : hotCount,
    warm: warmCount,
    hot: hotCount,
    cold: coldCount,
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
      phoneMasked: f.lead?.phoneMasked,
      scheduledAt: f.scheduledAt,
      status: f.status,
    })),
    upcomingFollowups,
    salesFunnel,
    actionRequired,
    financials,
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
      connected: monthlyLeadTrend.map((m) => m.connectedLeads),
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
      salesFunnel,
      actionRequired,
      financials,
      statusDistribution,
      statusDistributionSummary,
      leadsBySource: leadsBySourcePeriod,
      monthlyLeadTrend,
      dailyLeadTrend,
      conversionRateTrend,
      revenueVsBookings,
      topDestinations,
      keyHighlights,
    },
  };
}

/** Payment has no destination field — join to Lead the same way its `lead` ref is indexed for. */
async function sumRevenueForDestination(branchId, start, end, destinationValues) {
  if (!Array.isArray(destinationValues) || !destinationValues.length) return 0;
  const match = { status: { $in: ['paid', 'partial'] } };
  if (start && end) match.paidAt = { $gte: start, $lte: end };
  const rows = await Payment.aggregate([
    { $match: withBranch(match, branchId) },
    {
      $lookup: {
        from: Lead.collection.name,
        localField: 'lead',
        foreignField: '_id',
        as: 'leadDoc',
      },
    },
    { $unwind: '$leadDoc' },
    { $match: { 'leadDoc.destination': { $in: destinationValues } } },
    { $group: { _id: null, total: { $sum: '$paidAmount' } } },
  ]);
  return rows[0]?.total || 0;
}

/**
 * Destination drill-down for the Admin Dashboard's Top Destinations chart. `names` is the full
 * list of rollup names a clicked chart segment represents (usually one state, or several when the
 * segment is the frontend's merged "Others" slice) — resolved back to raw Lead.destination values
 * via the exact same state-hierarchy logic buildAdminDashboard's topDestinations already uses, so
 * the drill-down can never disagree with the chart the admin clicked. Reuses the same period
 * resolution, status-bucket helpers, and revenue/conversion-rate formulas as buildAdminDashboard —
 * only the destination scope is new.
 */
async function buildDestinationDetail(options = {}) {
  const { branchId, dateFrom, dateTo, source, names } = options;
  const { isAllTime, periodStart, periodEnd } = resolveReportPeriod(dateFrom, dateTo);
  const sourceFilter = source ? { source } : {};
  const baseScope = activeLeadScope(
    isAllTime ? { ...sourceFilter } : { createdAt: { $gte: periodStart, $lte: periodEnd }, ...sourceFilter },
    branchId
  );

  const destinationValues = await resolveDestinationGroupValues(names, baseScope);
  const scope = { ...baseScope, destination: { $in: destinationValues } };

  const statusOptionKeys = await resolveStatusOptionKeys();
  const [totalLeads, statusAgg, warmCount, hotCount, coldCount, revenue] = await Promise.all([
    Lead.countDocuments(scope),
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    countLeadsByStatusOption(branchId, statusOptionKeys.warm, scope),
    countLeadsByStatusOption(branchId, statusOptionKeys.hot, scope),
    countLeadsByStatusOption(branchId, statusOptionKeys.cold, scope),
    sumRevenueForDestination(branchId, isAllTime ? null : periodStart, isAllTime ? null : periodEnd, destinationValues),
  ]);

  const statusCounts = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const buckets = mapStatusBucket(statusCounts);
  const conversionRate = totalLeads ? Math.round((buckets.conversions / totalLeads) * 1000) / 10 : 0;

  return {
    period: {
      from: isAllTime ? null : periodStart.toISOString(),
      to: periodEnd.toISOString(),
      isAllTime,
      label: isAllTime
        ? 'All Time'
        : `${periodStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    },
    destinationValues,
    kpis: {
      totalLeads,
      connected: buckets.connected,
      warm: warmCount,
      hot: hotCount,
      cold: coldCount,
      bookings: buckets.conversions,
      revenue,
      conversionRate,
    },
  };
}

/**
 * Complete destination breakdown (no Top-N cap) for the "View all destinations" drill-down —
 * same period/branch/source scope, same aggregateDestinationCounts + rollupCityStatsIntoStates
 * pipeline as buildAdminDashboard's Top-12 card, just without the display `limit`, so every
 * matching lead is represented in the returned rows (sum(destinations[].queries) === totalLeads).
 */
async function buildAllDestinations(options = {}) {
  const { branchId, dateFrom, dateTo, source } = options;
  const { isAllTime, periodStart, periodEnd } = resolveReportPeriod(dateFrom, dateTo);
  const sourceFilter = source ? { source } : {};
  const scope = activeLeadScope(
    isAllTime
      ? { ...sourceFilter }
      : { createdAt: { $gte: periodStart, $lte: periodEnd }, ...sourceFilter },
    branchId
  );

  const destinationAgg = await aggregateDestinationCounts(scope);

  const destinations = await rollupCityStatsIntoStates(
    destinationAgg.map((row) => ({
      name: row.name,
      queries: row.queries || 0,
      conversions: row.conversions || 0,
      conversionRate: row.queries
        ? Math.round(((row.conversions || 0) / row.queries) * 1000) / 10
        : 0,
    })),
    {
      nameField: 'name',
      metricFields: ['queries', 'conversions'],
      rateConfig: { field: 'conversionRate', numerator: 'conversions', denominator: 'queries' },
      sortField: 'queries',
      // "Not specified" here (vs. the Top-12 card's "Other") only changes the display label for
      // this endpoint's missing-destination row — classifyDestination treats both labels (plus
      // "Others") as the same bucket, so a click-through still resolves correctly either way.
      groupUnknownAs: 'Not specified',
      // No `limit` — this endpoint's entire purpose is the complete, uncapped breakdown.
    }
  );

  const totalLeads = destinations.reduce((sum, d) => sum + (Number(d.queries) || 0), 0);
  const withPercentage = destinations.map((d) => ({
    ...d,
    percentage: totalLeads ? Math.round((d.queries / totalLeads) * 1000) / 10 : 0,
  }));

  return {
    period: {
      from: isAllTime ? null : periodStart.toISOString(),
      to: periodEnd.toISOString(),
      isAllTime,
      label: isAllTime
        ? 'All Time'
        : `${periodStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    },
    totalLeads,
    destinations: withPercentage,
  };
}

async function buildExecutiveDashboard(userId, options = {}) {
  const { branchId, destinationPeriod = 'all', dateFrom, dateTo } = options;
  const execId = userId;
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const {
    isAllTime,
    periodStart,
    periodEnd,
    prevStart,
    prevEnd,
  } = resolveReportPeriod(dateFrom, dateTo);

  const hasCustomRange = Boolean(dateFrom || dateTo);
  const destinationRange = hasCustomRange && !isAllTime
    ? { start: periodStart, end: periodEnd }
    : null;

  const chartSpanDays = Math.min(
    30,
    Math.max(7, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1)
  );
  const chartStart = startOfDay(
    new Date(periodEnd.getTime() - (chartSpanDays - 1) * 24 * 60 * 60 * 1000)
  );

  const leadScope = withBranch({ assignedTo: execId }, branchId);
  const leadIds = await Lead.find(leadScope).distinct('_id');
  const followScope = { $or: [{ assignedTo: execId }, { lead: { $in: leadIds } }] };
  const quoteScope = { $or: [{ createdByExecutive: execId }, { lead: { $in: leadIds } }] };

  const periodTouch = {
    $or: [
      { createdAt: { $gte: periodStart, $lte: periodEnd } },
      { assignedAt: { $gte: periodStart, $lte: periodEnd } },
    ],
  };
  const prevTouch = {
    $or: [
      { createdAt: { $gte: prevStart, $lte: prevEnd } },
      { assignedAt: { $gte: prevStart, $lte: prevEnd } },
    ],
  };

  // All-time keeps live pipeline counts; date filters scope activity to the range.
  // Total / myLeads = active assigned only (exclude lost + converted + repeated).
  const activeLeadScope = isAllTime
    ? {
        ...leadScope,
        isDeleted: { $ne: true },
        isRepeatCustomer: { $ne: true },
        status: { $nin: ['lost', 'booked_from_another_company', 'converted'] },
      }
    : {
        ...leadScope,
        isDeleted: { $ne: true },
        isRepeatCustomer: { $ne: true },
        status: { $nin: ['lost', 'booked_from_another_company', 'converted'] },
        ...periodTouch,
      };
  const freshLeadScope = isAllTime
    ? {
        ...leadScope,
        $or: [
          { createdAt: { $gte: todayStart, $lte: todayEnd } },
          { assignedAt: { $gte: todayStart, $lte: todayEnd } },
        ],
      }
    : { ...leadScope, ...periodTouch };
  const connectedScope = isAllTime
    ? { ...leadScope, status: 'contacted' }
    : { ...leadScope, status: 'contacted', ...periodTouch };
  const hotScope = isAllTime
    ? {
        ...leadScope,
        isHot: true,
        status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
      }
    : {
        ...leadScope,
        isHot: true,
        status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
        ...periodTouch,
      };
  const convertedScope = isAllTime
    ? { ...leadScope, status: 'converted' }
    : {
        ...leadScope,
        status: 'converted',
        $or: [
          { convertedAt: { $gte: periodStart, $lte: periodEnd } },
          {
            $and: [
              { $or: [{ convertedAt: null }, { convertedAt: { $exists: false } }] },
              { updatedAt: { $gte: periodStart, $lte: periodEnd } },
            ],
          },
        ],
      };
  const followPendingScope = isAllTime
    ? { ...followScope, status: 'pending' }
    : {
        ...followScope,
        status: 'pending',
        scheduledAt: { $gte: periodStart, $lte: periodEnd },
      };
  const todayFollowScope = isAllTime
    ? {
        ...followScope,
        scheduledAt: { $gte: todayStart, $lte: todayEnd },
        status: 'pending',
      }
    : {
        ...followScope,
        scheduledAt: { $gte: periodStart, $lte: periodEnd },
        status: 'pending',
      };
  const monthStart = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), 1));
  const revenueStart = isAllTime ? monthStart : periodStart;
  const revenueEnd = isAllTime ? todayEnd : periodEnd;
  const revenueMatch = withBranch(
    {
      status: { $in: ['paid', 'partial'] },
      lead: { $in: leadIds },
      $or: [
        { paidAt: { $gte: revenueStart, $lte: revenueEnd } },
        { paidAt: null, createdAt: { $gte: revenueStart, $lte: revenueEnd } },
      ],
    },
    branchId
  );
  const prevRevenueMatch = withBranch(
    {
      status: { $in: ['paid', 'partial'] },
      lead: { $in: leadIds },
      $or: [
        { paidAt: { $gte: prevStart, $lte: prevEnd } },
        { paidAt: null, createdAt: { $gte: prevStart, $lte: prevEnd } },
      ],
    },
    branchId
  );
  const periodLabel = isAllTime
    ? 'All time'
    : `${periodStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${periodEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const trendPeriod = isAllTime ? 'from last month' : 'vs prior period';

  const [
    myLeads,
    todayLeads,
    connectedLeads,
    followUpPending,
    hotLeads,
    convertedCount,
    todayFollowupCount,
    todayFollowups,
    quotesSentCount,
    monthlyRevenueAgg,
    totalLeadValueAgg,
    recentLeadsRaw,
    myFollowups,
    statusAgg,
    emailStats,
    sourceAgg,
    prevMyLeads,
    prevFollowups,
    prevHotLeads,
    prevQuotes,
    prevConverted,
    prevRevenueAgg,
    leadTrendAgg,
    followupTrendAgg,
    convertedTrendAgg,
    todayActivitiesRaw,
    topLeadsRaw,
    coldCallRemindersRaw,
    destinationWise,
  ] = await Promise.all([
    Lead.countDocuments(activeLeadScope),
    Lead.countDocuments(freshLeadScope),
    Lead.countDocuments(connectedScope),
    FollowUp.countDocuments(followPendingScope),
    Lead.countDocuments(hotScope),
    Lead.countDocuments(convertedScope),
    FollowUp.countDocuments(todayFollowScope),
    FollowUp.find(todayFollowScope)
      .populate('lead', 'name destination')
      .sort({ scheduledAt: 1 })
      .limit(20)
      .lean(),
    Quotation.countDocuments(
      isAllTime
        ? {
            ...quoteScope,
            status: { $in: ['sent', 'negotiation', 'approved', 'viewed', 'pending_approval'] },
          }
        : {
            ...quoteScope,
            status: { $in: ['sent', 'negotiation', 'approved', 'viewed', 'pending_approval'] },
            createdAt: { $gte: periodStart, $lte: periodEnd },
          }
    ),
    Payment.aggregate([
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
    Lead.aggregate([
      {
        $match: activeLeadScope,
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$budget', 0] } } } },
    ]),
    Lead.find(isAllTime ? leadScope : { ...leadScope, ...periodTouch })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    FollowUp.find({ ...followScope, status: 'pending', scheduledAt: { $gte: new Date() } })
      .populate('lead', 'name destination')
      .sort({ scheduledAt: 1 })
      .limit(6)
      .lean(),
    Lead.aggregate([
      { $match: isAllTime ? leadScope : { ...leadScope, ...periodTouch } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    getEmailDashboardStats({ branchId, userId: execId }),
    Lead.aggregate([
      { $match: isAllTime ? leadScope : { ...leadScope, ...periodTouch } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]),
    Lead.countDocuments({
      ...leadScope,
      status: { $nin: ['lost', 'booked_from_another_company'] },
      ...prevTouch,
    }),
    FollowUp.countDocuments({
      ...followScope,
      scheduledAt: { $gte: prevStart, $lte: prevEnd },
      status: 'pending',
    }),
    Lead.countDocuments({
      ...leadScope,
      isHot: true,
      status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
      ...prevTouch,
    }),
    Quotation.countDocuments({
      ...quoteScope,
      status: { $in: ['sent', 'negotiation', 'approved', 'viewed', 'pending_approval'] },
      createdAt: { $gte: prevStart, $lte: prevEnd },
    }),
    Lead.countDocuments({
      ...leadScope,
      status: 'converted',
      $or: [
        { convertedAt: { $gte: prevStart, $lte: prevEnd } },
        {
          $and: [
            { $or: [{ convertedAt: null }, { convertedAt: { $exists: false } }] },
            { updatedAt: { $gte: prevStart, $lte: prevEnd } },
          ],
        },
      ],
    }),
    Payment.aggregate([
      { $match: prevRevenueMatch },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
    Lead.aggregate([
      { $match: { ...leadScope, createdAt: { $gte: chartStart, $lte: periodEnd } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    FollowUp.aggregate([
      { $match: { ...followScope, scheduledAt: { $gte: chartStart, $lte: periodEnd } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' } }, count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      {
        $match: {
          ...leadScope,
          status: 'converted',
          $or: [
            { convertedAt: { $gte: chartStart, $lte: periodEnd } },
            {
              $and: [
                { $or: [{ convertedAt: null }, { convertedAt: { $exists: false } }] },
                { updatedAt: { $gte: chartStart, $lte: periodEnd } },
              ],
            },
          ],
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $ifNull: ['$convertedAt', '$updatedAt'] },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    LeadActivity.find({
      actorId: execId,
      createdAt: { $gte: isAllTime ? todayStart : periodStart, $lte: isAllTime ? todayEnd : periodEnd },
      ...(branchId ? { branchId } : {}),
    })
      .populate('leadId', 'name destination')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    Lead.find({
      ...(isAllTime ? leadScope : { ...leadScope, ...periodTouch }),
      status: { $nin: ['lost', 'booked_from_another_company'] },
    })
      .sort({ isHot: -1, budget: -1, updatedAt: -1 })
      .limit(3)
      .lean(),
    Lead.find({
      ...leadScope,
      coldCallPending: true,
      status: { $nin: ['lost', 'booked_from_another_company', 'converted'] },
    })
      .select('leadId name phone destination assignedTo coldReason coldCallReminderAt coldCallFollowUpId')
      .sort({ coldCallReminderAt: 1 })
      .limit(20)
      .lean(),
    buildDestinationWiseStats(leadScope, destinationPeriod, destinationRange),
  ]);

  // Cold Call Reminders is the one widget in this dashboard whose final response shape still
  // carries `phone` — gate it the same way every other lead-phone surface is gated (topLeads/
  // recentLeads below already drop `phone` entirely before returning, so they need no change).
  await maskDashboardLeads(coldCallRemindersRaw);

  const statusCounts = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const statusDist = buildExclusiveStatusDistribution(statusCounts);
  const enrichedRecent = recentLeadsRaw.map(enrichLead);
  const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;
  const totalLeadValue = totalLeadValueAgg[0]?.total || 0;
  const lastMonthRevenue = prevRevenueAgg[0]?.total || 0;
  const totalAssigned = statusDist.summary.total;
  const monthlyTargets = await getMonthlyTargets(execId);
  const primaryTarget =
    Number(monthlyTargets.totalSalesTarget) > 0
      ? Number(monthlyTargets.totalSalesTarget)
      : Number(monthlyTargets.revenueTarget) || 0;
  const targetStats = buildTargetProgress(monthlyRevenue, primaryTarget);

  const pipelineOverview = statusDist.items
    .filter((item) => item.value > 0)
    .map((item) => ({ name: item.name, value: item.value, color: item.color }));
  if (hotLeads > 0) {
    pipelineOverview.push({ name: 'Hot Leads', value: hotLeads, color: '#F97316' });
  }

  const leadSources = sourceAgg
    .map((s, i) => ({
      name: formatSourceName(s._id),
      value: s.count,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const trendMaps = {
    leads: new Map(leadTrendAgg.map((row) => [row._id, row.count])),
    followups: new Map(followupTrendAgg.map((row) => [row._id, row.count])),
    converted: new Map(convertedTrendAgg.map((row) => [row._id, row.count])),
  };
  const leadOverview = Array.from({ length: chartSpanDays }, (_, index) => {
    const date = new Date(chartStart);
    date.setDate(date.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      leads: trendMaps.leads.get(key) || 0,
      followups: trendMaps.followups.get(key) || 0,
      converted: trendMaps.converted.get(key) || 0,
    };
  });

  return {
    filters: {
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      destinationPeriod: destinationPeriod || 'all',
      isAllTime,
      periodLabel,
    },
    emailStats,
    kpis: {
      myLeads,
      todayLeads,
      connectedLeads,
      workingProgress: statusCounts.working_progress || 0,
      followUpPending,
      todayFollowups: todayFollowupCount,
      hotLeads,
      quotationsSent: quotesSentCount,
      convertedLeads: convertedCount,
      monthlyRevenue,
      totalLeadValue,
    },
    kpiTrends: {
      myLeads: { change: pctChange(myLeads, prevMyLeads), period: trendPeriod },
      todayLeads: {
        change: isAllTime ? 0 : pctChange(todayLeads, prevMyLeads),
        period: isAllTime ? 'today' : trendPeriod,
      },
      connectedLeads: { change: 0, period: isAllTime ? 'live' : periodLabel },
      workingProgress: { change: 0, period: isAllTime ? 'live' : periodLabel },
      followUpPending: { change: pctChange(followUpPending, prevFollowups), period: isAllTime ? 'pending' : trendPeriod },
      todayFollowups: {
        change: pctChange(todayFollowupCount, prevFollowups),
        period: isAllTime ? 'from yesterday' : trendPeriod,
      },
      hotLeads: { change: pctChange(hotLeads, prevHotLeads), period: trendPeriod },
      quotationsSent: { change: pctChange(quotesSentCount, prevQuotes), period: trendPeriod },
      convertedLeads: { change: pctChange(convertedCount, prevConverted), period: trendPeriod },
      monthlyRevenue: { change: pctChange(monthlyRevenue, lastMonthRevenue), period: trendPeriod },
    },
    pipelineOverview,
    leadSources,
    leadOverview,
    todayActivities: todayActivitiesRaw.map((activity) => ({
      _id: activity._id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      customer: activity.leadId?.name,
      destination: activity.leadId?.destination,
      createdAt: activity.createdAt,
    })),
    topLeads: topLeadsRaw.map((lead) => ({
      _id: lead._id,
      leadId: lead.leadId,
      name: lead.name,
      destination: lead.destination,
      budget: lead.budget || 0,
      status: lead.status,
      isHot: !!lead.isHot,
    })),
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
      createdAt: l.createdAt,
    })),
    upcomingFollowups: myFollowups.map((f) => ({
      _id: f._id,
      customer: f.lead?.name,
      destination: f.lead?.destination,
      scheduledAt: f.scheduledAt,
      priority: f.priority || 'medium',
    })),
    conversionProgress: statusDist.items.map((item) => ({
      stage: item.name,
      count: item.value,
      color: item.color,
      key: item.key,
      pct: item.pct,
    })),
    statusDistributionSummary: {
      ...statusDist.summary,
      hot: hotLeads,
      periodLabel,
    },
    target: {
      ...targetStats,
      revenueTarget: Number(monthlyTargets.revenueTarget) || 0,
      packageTarget: Number(monthlyTargets.packageTarget) || 0,
      totalSalesTarget: Number(monthlyTargets.totalSalesTarget) || 0,
      profitTarget: Number(monthlyTargets.profitTarget) || 0,
      periodType: monthlyTargets.periodType || 'monthly',
      workingDays: monthlyTargets.workingDays || 26,
      setByName: monthlyTargets.setByName || '',
      isDefault: Boolean(monthlyTargets.isDefault),
      leadsConverted: convertedCount,
      conversionRate: totalAssigned
        ? Math.round((convertedCount / totalAssigned) * 1000) / 10
        : 0,
      weeklyRevenue: [],
    },
    coldCallReminders: coldCallRemindersRaw.map((lead) => ({
      _id: lead._id,
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      phoneMasked: lead.phoneMasked,
      destination: lead.destination,
      coldReason: lead.coldReason,
      scheduledAt: lead.coldCallReminderAt,
      followUpId: lead.coldCallFollowUpId,
    })),
    destinationWise: {
      period: hasCustomRange ? 'custom' : destinationPeriod || 'all',
      rows: destinationWise,
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
    workingProgress,
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
    Lead.countDocuments(withBranch({ status: 'working_progress' }, branchId)),
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
      .populate('lead', 'name destination phone source sourceLabel')
      .populate('assignedTo', 'name')
      .sort({ scheduledAt: 1 })
      .limit(8)
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

  const colorsBySource = {
    dpw: '#7C3AED',
    dpw_wa: '#14B8A6',
    dpw_call: '#F59E0B',
    dpw2: '#3B82F6',
    dpw2_wa: '#0EA5E9',
    dpw2_call: '#F97316',
    referral: '#8B5CF6',
    call_lead: '#10B981',
    organic: '#64748B',
    whatsapp: '#14B8A6',
    social: '#3B82F6',
    facebook_ads: '#3B82F6',
    phone: '#10B981',
    website: '#7C3AED',
    google_ads: '#7C3AED',
    other: '#94A3B8',
  };
  const palette = ['#7C3AED', '#3B82F6', '#10B981', '#14B8A6', '#F59E0B', '#EC4899'];

  const leadSources = sourceAgg
    .map((s, i) => {
      const key = String(s._id || 'other').toLowerCase();
      return {
        name: formatSourceName(s._id),
        value: s.count,
        color: colorsBySource[key] || palette[i % palette.length],
      };
    })
    .sort((a, b) => b.value - a.value);

  const now = new Date();
  const year = now.getFullYear();
  const monthlyCreated = await Lead.aggregate([
    {
      $match: withBranch(
        {
          createdAt: {
            $gte: new Date(year, 0, 1),
            $lte: now,
          },
        },
        branchId
      ),
    },
    {
      $group: {
        _id: { month: { $month: '$createdAt' } },
        total: { $sum: 1 },
        converted: {
          $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
        },
      },
    },
  ]);
  const monthMap = Object.fromEntries(
    monthlyCreated.map((r) => [r._id.month, r])
  );
  const monthlyConversion = Array.from({ length: now.getMonth() + 1 }, (_, i) => {
    const m = i + 1;
    const row = monthMap[m];
    const total = row?.total || 0;
    const conv = row?.converted || 0;
    return {
      month: MONTH_LABELS[i],
      rate: total ? Math.round((conv / total) * 1000) / 10 : 0,
    };
  });

  const topSource = leadSources[0];
  const bestExec = [...executivePerformance].sort((a, b) => b.conversions - a.conversions || b.leads - a.leads)[0];
  const sourceTotal = leadSources.reduce((s, x) => s + x.value, 0) || 1;

  return {
    kpis: {
      totalTeamLeads,
      newLeadsToday: newToday,
      pendingFollowups,
      workingProgress,
      convertedLeads: converted,
      teamRevenue,
      conversionRate,
    },
    keyHighlights: {
      periodLabel: 'This week',
      highestLeadsSource: topSource
        ? { name: topSource.name, pct: Math.round((topSource.value / sourceTotal) * 1000) / 10 }
        : { name: '—', pct: 0 },
      bestPerformingExecutive: bestExec
        ? { name: bestExec.name, conversions: bestExec.conversions }
        : { name: '—' },
      conversionRate,
      revenueGenerated: teamRevenue,
    },
    leadSources,
    teamRevenueChart: await aggregateConvertedPackageRevenueByMonth({ branchId }),
    teamRevenueWeek: await buildTeamRevenueWeekSeries({ branchId }),
    executivePerformance,
    monthlyConversion,
    recentLeads: recentLeads.map((l) => ({
      _id: l._id,
      leadId: l.leadId,
      name: l.name,
      phone: l.phone || '',
      destination: l.destination,
      budget: l.budget,
      status: l.status,
      executive: l.assignedTo?.name || 'Unassigned',
      source: l.sourceLabel || l.source,
      isHot: l.isHot,
      createdAt: l.createdAt,
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
    upcomingFollowups: upcomingFollowups.map((f) => {
      const lead = f.lead || {};
      return {
        _id: f._id,
        customer: lead.name,
        phone: lead.phone || '',
        destination: lead.destination,
        source: lead.sourceLabel || formatSourceName(lead.source),
        executive: f.assignedTo?.name,
        scheduledAt: f.scheduledAt,
        priority: f.priority || 'medium',
      };
    }),
    teamRanking: [...executivePerformance]
      .sort((a, b) => b.leads - a.leads || b.conversions - a.conversions || b.revenue - a.revenue)
      .map((m, i) => ({ ...m, rank: i + 1 })),
    reactivationWidget,
  };
}

async function buildTeamRevenueWeekSeries({ branchId } = {}) {
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = startOfDay();
  const monday = startOfDay(new Date(today));
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sundayEnd = endOfDay(sunday);

  const rows = await Quotation.aggregate([
    { $match: { status: 'approved', ...(branchId ? { branchId } : {}) } },
    {
      $lookup: {
        from: 'leads',
        localField: 'lead',
        foreignField: '_id',
        as: 'leadDoc',
      },
    },
    { $unwind: '$leadDoc' },
    {
      $match: {
        'leadDoc.status': 'converted',
        updatedAt: { $gte: monday, $lte: sundayEnd },
        ...(branchId ? { 'leadDoc.branchId': branchId } : {}),
      },
    },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: { lead: '$lead', day: { $dayOfWeek: '$updatedAt' } },
        amount: { $first: { $ifNull: ['$pricing.total', 0] } },
      },
    },
    {
      $group: {
        _id: '$_id.day',
        revenue: { $sum: '$amount' },
      },
    },
  ]);

  // Mongo $dayOfWeek: 1=Sun … 7=Sat → map to Mon-first index 0..6
  const byDow = Object.fromEntries(rows.map((r) => [r._id, r.revenue]));
  return DAY_LABELS.map((day, i) => {
    const mongoDow = i === 6 ? 1 : i + 2;
    return { day, revenue: byDow[mongoDow] || 0 };
  });
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
          workingProgress: [{ $match: { status: 'working_progress' } }, { $count: 'n' }],
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
      workingProgress: facetCount(facet, 'workingProgress'),
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
  const { branchId, dateFrom, dateTo } = options;
  const { isAllTime, periodStart, periodEnd } = resolveReportPeriod(dateFrom, dateTo);
  const leadDate = isAllTime ? {} : { createdAt: { $gte: periodStart, $lte: periodEnd } };
  const payDate = isAllTime ? {} : { paidAt: { $gte: periodStart, $lte: periodEnd } };
  const leadScope = withBranch({ ...leadDate }, branchId);
  const convertedScope = withBranch({ ...leadDate, status: 'converted' }, branchId);
  const payScope = withBranch({ status: { $in: ['paid', 'partial'] }, ...payDate }, branchId);
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
    Lead.countDocuments(leadScope),
    Lead.countDocuments(convertedScope),
    Payment.aggregate([
      { $match: payScope },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
    Lead.aggregate([
      { $match: leadScope },
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
      { $match: leadScope },
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
    ]),
    Lead.aggregate([{ $match: leadScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.find(withBranch({ role: 'sales_executive', status: 'active' }, branchId)).select('name email').lean(),
    Package.find().select('name').limit(6).lean(),
    Payment.aggregate([
      { $match: payScope },
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
        Lead.countDocuments({ assignedTo: ex._id, ...leadDate }),
        FollowUp.countDocuments({ assignedTo: ex._id, status: 'completed' }),
        Lead.countDocuments({ assignedTo: ex._id, status: 'converted', ...leadDate }),
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
    { stage: 'Connected', key: 'contacted' },
    { stage: 'Follow Up', key: 'follow_up' },
    { stage: 'Quotation Sent', key: 'quotation_sent' },
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

  const destinations = await rollupCityStatsIntoStates(
    destAgg.map((d) => ({
      destination: d._id,
      leads: d.leads,
      conversions: d.conversions,
      revenue: d.revenue,
    })),
    {
      nameField: 'destination',
      metricFields: ['leads', 'conversions', 'revenue'],
      sortField: 'leads',
      limit: 8,
    }
  );

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
    destinations,
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
  const { branchId, dateFrom, dateTo, source } = options;
  const executives = await User.find(withBranch({ role: 'sales_executive', status: 'active' }, branchId)).lean();

  // Reuse the SAME executive-performance calculation the Action Required "Low Follow-up
  // Executives" KPI uses (leadAnalyticsService.getExecutivePerformance, called from
  // buildAdminDashboard) — so this drill-down can never diverge from what the KPI counted, and
  // so it respects the same dashboard date period instead of a second, independent definition.
  const executivePerf = await getExecutivePerformance(branchId, { dateFrom, dateTo, source });
  const perfByExec = new Map((executivePerf.executives || []).map((ex) => [String(ex._id), ex]));

  const members = await Promise.all(
    executives.map(async (ex) => {
      const [assigned, converted, followUps, revenue] = await Promise.all([
        Lead.countDocuments({ assignedTo: ex._id }),
        Lead.countDocuments({ assignedTo: ex._id, status: 'converted' }),
        FollowUp.countDocuments({ assignedTo: ex._id, status: 'pending' }),
        sumConvertedPackageRevenue({ assigneeId: ex._id, branchId }),
      ]);
      const perf = perfByExec.get(String(ex._id));
      const followUpCompletion = Number(perf?.followUpCompletion || 0);
      const perfAssigned = Number(perf?.assigned || 0);
      return {
        name: ex.name,
        assigned,
        converted,
        conversions: converted,
        followUps,
        revenue,
        conversionRate: assigned ? Math.round((converted / assigned) * 100) : 0,
        followUpCompletion,
        // Same threshold + population rule as the Action Required KPI (LOW_FOLLOWUP_COMPLETION_THRESHOLD),
        // evaluated over the SAME getExecutivePerformance result the KPI itself used.
        lowFollowUp: followUpCompletion < LOW_FOLLOWUP_COMPLETION_THRESHOLD && perfAssigned > 0,
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
    period: executivePerf.period,
    teamRevenue: members.reduce((sum, m) => sum + m.revenue, 0),
    teamConversions: members.reduce((sum, m) => sum + m.conversions, 0),
    teamFollowUps: await FollowUp.countDocuments({ status: 'pending' }),
    lowFollowUpCount: members.filter((m) => m.lowFollowUp).length,
  };
}

module.exports = {
  buildAdminDashboard,
  buildDestinationDetail,
  buildAllDestinations,
  buildExecutiveDashboard,
  buildSalesManagerDashboard,
  buildTeamLeaderDashboard,
  buildTeamPerformance,
  buildReportsAnalytics,
};
