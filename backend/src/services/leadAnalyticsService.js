const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const User = require('../models/User');
const { withBranch } = require('../utils/branchScope');

const SOURCE_LABELS = {
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
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
              { $in: ['$status', ['new', 'contacted', 'working_progress', 'follow_up', 'quotation_sent', 'negotiation']] },
              1,
              0,
            ],
          },
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

async function getExecutivePerformance(branchId) {
  const execFilter = {
    role: 'sales_executive',
    status: 'active',
    ...(branchId ? { branchId } : {}),
  };
  const executives = await User.find(execFilter).select('name email').lean();
  const execIds = executives.map((e) => e._id);

  if (!execIds.length) return { executives: [] };

  const [assignedAgg, convertedAgg, followUpAgg, hotAgg] = await Promise.all([
    Lead.aggregate([
      { $match: { ...branchMatch(branchId), assignedTo: { $in: execIds } } },
      { $group: { _id: '$assignedTo', assigned: { $sum: 1 }, pipeline: { $sum: { $cond: [{ $ne: ['$status', 'converted'] }, 1, 0] } }, revenue: { $sum: '$budget' } } },
    ]),
    Lead.aggregate([
      { $match: { ...branchMatch(branchId), assignedTo: { $in: execIds }, status: 'converted' } },
      { $group: { _id: '$assignedTo', converted: { $sum: 1 }, revenue: { $sum: '$budget' } } },
    ]),
    FollowUp.aggregate([
      { $match: { ...(branchId ? { branchId } : {}), assignedTo: { $in: execIds } } },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { ...branchMatch(branchId), assignedTo: { $in: execIds }, temperature: { $in: ['hot', 'vip'] } } },
      { $group: { _id: '$assignedTo', hot: { $sum: 1 } } },
    ]),
  ]);

  const assignedMap = Object.fromEntries(assignedAgg.map((r) => [String(r._id), r]));
  const convertedMap = Object.fromEntries(convertedAgg.map((r) => [String(r._id), r]));
  const fuMap = Object.fromEntries(followUpAgg.map((r) => [String(r._id), r]));
  const hotMap = Object.fromEntries(hotAgg.map((r) => [String(r._id), r.hot]));

  const executives_data = executives.map((exec) => {
    const id = String(exec._id);
    const assigned = assignedMap[id]?.assigned || 0;
    const converted = convertedMap[id]?.converted || 0;
    const fu = fuMap[id] || {};
    const fuTotal = fu.total || 0;
    const fuCompleted = fu.completed || 0;
    return {
      _id: exec._id,
      name: exec.name,
      email: exec.email,
      assigned,
      converted,
      pipeline: assignedMap[id]?.pipeline || 0,
      revenue: convertedMap[id]?.revenue || assignedMap[id]?.revenue || 0,
      conversionRate: assigned ? Math.round((converted / assigned) * 1000) / 10 : 0,
      followUpCompletion: fuTotal ? Math.round((fuCompleted / fuTotal) * 100) : 0,
      missedFollowUps: fu.missed || 0,
      hotLeads: hotMap[id] || 0,
    };
  });

  executives_data.sort((a, b) => b.converted - a.converted || b.conversionRate - a.conversionRate);

  return { executives: executives_data };
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
