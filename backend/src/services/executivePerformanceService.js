const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const MonthlySalesTarget = require('../models/MonthlySalesTarget');
const { sumConvertedPackageRevenueByAssignees } = require('../utils/convertedPackageRevenue');
const {
  currentPeriod,
  buildTargetProgress,
  shapeTargetRow,
} = require('./salesTargetService');

function toIdString(value) {
  if (!value) return '';
  return String(value._id || value);
}

function emptyTemp() {
  return { hot: 0, warm: 0, cold: 0, vip: 0 };
}

function mapCountRows(rows = []) {
  return Object.fromEntries(rows.map((r) => [toIdString(r._id), r.count || 0]));
}

/**
 * Batch-load performance rows for many executives (avoids per-exec N+1 queries).
 */
async function buildExecutivePerformanceRows(executives = [], { branchId, includeTemperature = true } = {}) {
  if (!executives.length) return [];

  const idObjects = executives.map((ex) => new mongoose.Types.ObjectId(String(ex._id)));
  const branchMatch = branchId ? { branchId } : {};
  const period = currentPeriod();

  const [
    leadStatRows,
    tempRows,
    statusRows,
    followAssignedRows,
    followCreatedRows,
    quotationRows,
    revenueMap,
    targetDocs,
  ] = await Promise.all([
    Lead.aggregate([
      { $match: { assignedTo: { $in: idObjects }, ...branchMatch } },
      {
        $group: {
          _id: '$assignedTo',
          assignedLeads: { $sum: 1 },
          conversions: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
          },
          contacted: {
            $sum: { $cond: [{ $ne: ['$status', 'new'] }, 1, 0] },
          },
        },
      },
    ]),
    includeTemperature
      ? Lead.aggregate([
          { $match: { assignedTo: { $in: idObjects }, ...branchMatch } },
          {
            $group: {
              _id: { assignee: '$assignedTo', temperature: '$temperature' },
              count: { $sum: 1 },
            },
          },
        ])
      : Promise.resolve([]),
    includeTemperature
      ? Lead.aggregate([
          { $match: { assignedTo: { $in: idObjects }, ...branchMatch } },
          {
            $group: {
              _id: { assignee: '$assignedTo', status: '$status' },
              count: { $sum: 1 },
            },
          },
        ])
      : Promise.resolve([]),
    FollowUp.aggregate([
      {
        $match: {
          status: 'completed',
          assignedTo: { $in: idObjects },
          ...branchMatch,
        },
      },
      { $group: { _id: '$assignedTo', docs: { $addToSet: '$_id' } } },
    ]),
    FollowUp.aggregate([
      {
        $match: {
          status: 'completed',
          createdBy: { $in: idObjects },
          ...branchMatch,
        },
      },
      { $group: { _id: '$createdBy', docs: { $addToSet: '$_id' } } },
    ]),
    Quotation.aggregate([
      {
        $match: {
          createdByExecutive: { $in: idObjects },
          ...branchMatch,
        },
      },
      { $group: { _id: '$createdByExecutive', count: { $sum: 1 } } },
    ]),
    sumConvertedPackageRevenueByAssignees({ assigneeIds: idObjects, branchId }),
    MonthlySalesTarget.find({
      userId: { $in: idObjects },
      year: period.year,
      month: period.month,
    }).lean(),
  ]);

  const leadStatsMap = Object.fromEntries(
    leadStatRows.map((r) => [
      toIdString(r._id),
      {
        assignedLeads: r.assignedLeads || 0,
        conversions: r.conversions || 0,
        contacted: r.contacted || 0,
      },
    ])
  );

  const temperatureMap = {};
  tempRows.forEach((r) => {
    const key = toIdString(r._id.assignee);
    if (!temperatureMap[key]) temperatureMap[key] = emptyTemp();
    const temp = r._id.temperature || 'unknown';
    if (Object.prototype.hasOwnProperty.call(temperatureMap[key], temp)) {
      temperatureMap[key][temp] += r.count || 0;
    }
  });

  const statusMap = {};
  statusRows.forEach((r) => {
    const key = toIdString(r._id.assignee);
    if (!statusMap[key]) statusMap[key] = {};
    statusMap[key][r._id.status || 'unknown'] = r.count || 0;
  });

  const followAssignedDocMap = Object.fromEntries(
    followAssignedRows.map((r) => [toIdString(r._id), new Set((r.docs || []).map(String))])
  );
  const followCreatedDocMap = Object.fromEntries(
    followCreatedRows.map((r) => [toIdString(r._id), new Set((r.docs || []).map(String))])
  );
  const quotationMap = mapCountRows(quotationRows);
  const targetMap = Object.fromEntries(targetDocs.map((t) => [toIdString(t.userId), t]));

  const rows = executives.map((ex) => {
    const key = toIdString(ex._id);
    const stats = leadStatsMap[key] || { assignedLeads: 0, conversions: 0, contacted: 0 };
    const revenue = revenueMap[key] || 0;
    const targets = shapeTargetRow(targetMap[key], 'sales_executive', period);
    const targetStats = buildTargetProgress(revenue, targets.revenueTarget);
    const byStatusRaw = statusMap[key] || {};
    const temperature = temperatureMap[key] || emptyTemp();
    const followUnion = new Set([
      ...(followAssignedDocMap[key] || []),
      ...(followCreatedDocMap[key] || []),
    ]);

    const row = {
      _id: ex._id,
      name: ex.name,
      email: ex.email,
      role: 'sales_executive',
      assignedLeads: stats.assignedLeads,
      leads: stats.assignedLeads,
      followUpsDone: followUnion.size,
      quotationsSent: quotationMap[key] || 0,
      conversions: stats.conversions,
      converted: stats.conversions,
      revenue,
      conversionRate: stats.assignedLeads
        ? Math.round((stats.conversions / stats.assignedLeads) * 1000) / 10
        : 0,
      contacted: stats.contacted,
      monthlyTarget: targetStats.monthlyTarget,
      revenueTarget: targets.revenueTarget,
      packageTarget: targets.packageTarget,
      totalSalesTarget: targets.totalSalesTarget,
      profitTarget: targets.profitTarget,
      periodType: targets.periodType,
      workingDays: targets.workingDays,
      targetProgress: targetStats.progress,
    };

    if (includeTemperature) {
      row.temperature = {
        hot: temperature.hot || 0,
        warm: temperature.warm || 0,
        cold: temperature.cold || 0,
        vip: temperature.vip || 0,
      };
      row.byStatus = {
        new: byStatusRaw.new || 0,
        contacted: byStatusRaw.contacted || 0,
        follow_up: (byStatusRaw.follow_up || 0) + (byStatusRaw.working_progress || 0),
        quotation_sent: byStatusRaw.quotation_sent || 0,
        converted: byStatusRaw.converted || 0,
        lost: (byStatusRaw.lost || 0) + (byStatusRaw.booked_from_another_company || 0),
      };
    }

    return row;
  });

  rows.sort((a, b) => b.revenue - a.revenue).forEach((e, i) => {
    e.rank = i + 1;
  });

  return rows;
}

module.exports = {
  buildExecutivePerformanceRows,
};
