const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const User = require('../models/User');
const { withBranch } = require('../utils/branchScope');
const { startOfDay, endOfDay } = require('../utils/queryHelpers');

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
  google_ads: 'DPW',
  facebook_ads: 'DPW2',
  website: 'DPW',
  whatsapp: 'DPW2 WA',
  'walk-in': 'Call Lead',
  phone: 'Call Lead',
  social: 'DPW2',
  other: 'Organic',
};

const AGING_LABELS = {
  '0_7': '0-7 Days',
  '8_15': '8-15 Days',
  '16_30': '16-30 Days',
  '30_plus': '30+ Days',
};

function branchMatch(branchId) {
  return { isDeleted: { $ne: true }, ...withBranch({}, branchId) };
}

async function getSourceAnalytics(branchId) {
  const match = branchMatch(branchId);
  const rows = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$source',
        total: { $sum: 1 },
        converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
        lost: {
          $sum: {
            $cond: [{ $in: ['$status', ['lost', 'booked_from_another_company']] }, 1, 0],
          },
        },
        pipeline: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    'new',
                    'contacted',
                    'working_progress',
                    'qualified',
                    'follow_up',
                    'quotation_sent',
                    'negotiation',
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        connected: {
          $sum: {
            $cond: [{ $eq: ['$status', 'contacted'] }, 1, 0],
          },
        },
        bookings: {
          $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
        },
        totalBudget: { $sum: '$budget' },
        avgScore: { $avg: '$smartScore' },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return {
    sources: rows.map((r) => ({
      key: r._id || 'other',
      label: SOURCE_LABELS[r._id] || r._id || 'Other',
      total: r.total,
      converted: r.converted,
      connected: r.connected || 0,
      bookings: r.bookings || r.converted || 0,
      lost: r.lost,
      pipeline: r.pipeline,
      conversionRate: r.total ? Math.round((r.converted / r.total) * 1000) / 10 : 0,
      sharePct: grandTotal ? Math.round((r.total / grandTotal) * 100) : 0,
      totalBudget: r.totalBudget || 0,
      avgScore: Math.round(r.avgScore || 0),
    })),
    totalLeads: grandTotal,
  };
}

function resolvePerformancePeriod(dateFrom, dateTo) {
  const now = new Date();
  const isAllTime = !dateFrom && !dateTo;
  if (isAllTime) {
    return { isAllTime: true, periodStart: null, periodEnd: null };
  }
  return {
    isAllTime: false,
    periodStart: dateFrom ? startOfDay(new Date(dateFrom)) : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    periodEnd: dateTo ? endOfDay(new Date(dateTo)) : endOfDay(now),
  };
}

function periodTouchFilter(periodStart, periodEnd) {
  if (!periodStart || !periodEnd) return {};
  return {
    $or: [
      { createdAt: { $gte: periodStart, $lte: periodEnd } },
      { assignedAt: { $gte: periodStart, $lte: periodEnd } },
    ],
  };
}

async function getExecutivePerformance(branchId, options = {}) {
  const { dateFrom, dateTo, source } = options;
  const { isAllTime, periodStart, periodEnd } = resolvePerformancePeriod(dateFrom, dateTo);
  const sourceFilter = source ? { source } : {};
  const touch = periodTouchFilter(periodStart, periodEnd);

  const execFilter = {
    role: 'sales_executive',
    status: 'active',
    ...(branchId ? { branchId } : {}),
  };
  const executives = await User.find(execFilter).select('name email').lean();
  const execIds = executives.map((e) => e._id);

  if (!execIds.length) return { executives: [], period: { isAllTime, dateFrom: dateFrom || '', dateTo: dateTo || '' } };

  const baseLeadMatch = {
    ...branchMatch(branchId),
    assignedTo: { $in: execIds },
    ...sourceFilter,
  };
  const periodLeadMatch = isAllTime ? baseLeadMatch : { ...baseLeadMatch, ...touch };
  const convertedMatch = isAllTime
    ? { ...baseLeadMatch, status: 'converted' }
    : {
        ...baseLeadMatch,
        status: 'converted',
        updatedAt: { $gte: periodStart, $lte: periodEnd },
      };
  const quoteMatch = isAllTime
    ? { ...baseLeadMatch, status: { $in: ['quotation_sent', 'follow_up', 'negotiation'] } }
    : {
        ...baseLeadMatch,
        status: { $in: ['quotation_sent', 'follow_up', 'negotiation'] },
        ...touch,
      };
  const hotMatch = isAllTime
    ? { ...baseLeadMatch, temperature: { $in: ['hot', 'vip'] } }
    : { ...baseLeadMatch, temperature: { $in: ['hot', 'vip'] }, ...touch };

  const followMatch = {
    ...(branchId ? { branchId } : {}),
    assignedTo: { $in: execIds },
    ...(isAllTime ? {} : { scheduledAt: { $gte: periodStart, $lte: periodEnd } }),
  };

  const [assignedAgg, convertedAgg, followUpAgg, hotAgg, quoteAgg] = await Promise.all([
    Lead.aggregate([
      { $match: periodLeadMatch },
      {
        $group: {
          _id: '$assignedTo',
          assigned: { $sum: 1 },
          pipeline: {
            $sum: { $cond: [{ $ne: ['$status', 'converted'] }, 1, 0] },
          },
          revenue: { $sum: '$budget' },
        },
      },
    ]),
    Lead.aggregate([
      { $match: convertedMatch },
      { $group: { _id: '$assignedTo', converted: { $sum: 1 }, revenue: { $sum: '$budget' } } },
    ]),
    FollowUp.aggregate([
      { $match: followMatch },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        },
      },
    ]),
    Lead.aggregate([
      { $match: hotMatch },
      { $group: { _id: '$assignedTo', hot: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: quoteMatch },
      { $group: { _id: '$assignedTo', quotes: { $sum: 1 } } },
    ]),
  ]);

  const assignedMap = Object.fromEntries(assignedAgg.map((r) => [String(r._id), r]));
  const convertedMap = Object.fromEntries(convertedAgg.map((r) => [String(r._id), r]));
  const fuMap = Object.fromEntries(followUpAgg.map((r) => [String(r._id), r]));
  const hotMap = Object.fromEntries(hotAgg.map((r) => [String(r._id), r.hot]));
  const quoteMap = Object.fromEntries(quoteAgg.map((r) => [String(r._id), r.quotes]));

  const executives_data = executives.map((exec) => {
    const id = String(exec._id);
    const assigned = assignedMap[id]?.assigned || 0;
    const converted = convertedMap[id]?.converted || 0;
    const fu = fuMap[id] || {};
    const fuTotal = fu.total || 0;
    const fuCompleted = fu.completed || 0;
    const conversionRate = assigned ? Math.round((converted / assigned) * 1000) / 10 : 0;
    const followUpCompletion = fuTotal ? Math.round((fuCompleted / fuTotal) * 100) : 0;
    let performanceStatus = 'Inactive';
    if (assigned > 0 || fuTotal > 0 || converted > 0) {
      if (conversionRate >= 15 || followUpCompletion >= 80) performanceStatus = 'Excellent';
      else if (conversionRate >= 8 || followUpCompletion >= 60) performanceStatus = 'Good';
      else if (followUpCompletion >= 40 || assigned > 0) performanceStatus = 'Needs Attention';
      else performanceStatus = 'Low';
    }
    return {
      _id: exec._id,
      name: exec.name,
      email: exec.email,
      assigned,
      leads: assigned,
      followUps: fu.pending || fuTotal || 0,
      quotes: quoteMap[id] || 0,
      bookings: converted,
      converted,
      pipeline: assignedMap[id]?.pipeline || 0,
      revenue: convertedMap[id]?.revenue || assignedMap[id]?.revenue || 0,
      conversionRate,
      followUpCompletion,
      missedFollowUps: fu.missed || 0,
      hotLeads: hotMap[id] || 0,
      performanceStatus,
    };
  });

  executives_data.sort((a, b) => b.converted - a.converted || b.leads - a.leads || b.conversionRate - a.conversionRate);

  return {
    executives: executives_data,
    period: {
      isAllTime,
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
    },
  };
}

async function getEnterpriseKpis(branchId) {
  const match = branchMatch(branchId);

  const [
    agingBuckets,
    temperatureBuckets,
    slaBreached,
    slaAtRisk,
    slaMet,
    avgSmartScore,
    vipCount,
    unassigned,
  ] = await Promise.all([
    Lead.aggregate([{ $match: match }, { $group: { _id: '$agingBucket', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$temperature', count: { $sum: 1 } } }]),
    Lead.countDocuments({ ...match, slaBreached: true }),
    Lead.countDocuments({
      ...match,
      slaBreached: { $ne: true },
      firstContactAt: null,
      status: 'new',
      createdAt: { $gte: new Date(Date.now() - 15 * 60000), $lt: new Date() },
    }),
    Lead.countDocuments({ ...match, firstContactAt: { $ne: null } }),
    Lead.aggregate([{ $match: match }, { $group: { _id: null, avg: { $avg: '$smartScore' } } }]),
    Lead.countDocuments({ ...match, isVip: true }),
    Lead.countDocuments({ ...match, assignedTo: null }),
  ]);

  const aging = agingBuckets.map((b) => ({
    key: b._id,
    label: AGING_LABELS[b._id] || b._id,
    count: b.count,
  }));

  const temperature = temperatureBuckets.map((b) => ({
    key: b._id || 'cold',
    label: (b._id || 'cold').charAt(0).toUpperCase() + (b._id || 'cold').slice(1),
    count: b.count,
  }));

  return {
    aging,
    temperature,
    sla: { breached: slaBreached, atRisk: slaAtRisk, met: slaMet },
    avgSmartScore: Math.round(avgSmartScore[0]?.avg || 0),
    vipCount,
    unassigned,
  };
}

module.exports = {
  getSourceAnalytics,
  getExecutivePerformance,
  getEnterpriseKpis,
  SOURCE_LABELS,
  AGING_LABELS,
};
