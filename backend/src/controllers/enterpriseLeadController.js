const Lead = require('../models/Lead');
const CallNote = require('../models/CallNote');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { LEAD_POPULATE, enrichLead } = require('../utils/queryHelpers');
const { findDuplicateLeads } = require('../services/duplicateDetectionService');
const { getLeadTimeline } = require('../services/leadActivityService');
const { getEntityAuditLog } = require('../services/leadAuditService');
const { logLeadActivity } = require('../services/leadActivityService');
const { logAudit } = require('../services/leadAuditService');
const { getClientIp } = require('../services/activityService');
const { applyLeadMetrics } = require('../services/leadScoringService');
const { mergeLeads } = require('../services/leadMergeService');
const { getLeadTransferHistory } = require('../services/leadTransferService');
const {
  getSourceAnalytics,
  getExecutivePerformance,
  getEnterpriseKpis,
} = require('../services/leadAnalyticsService');
const { getSlaDashboard } = require('../services/slaService');
const { listBranchAuditLogs } = require('../services/leadAuditService');
const checkDuplicate = asyncHandler(async (req, res) => {
  const { phone, alternatePhone, excludeId } = req.query;
  const duplicates = await findDuplicateLeads({
    phone,
    alternatePhone,
    branchId: req.branchId,
    excludeId,
  });

  const matches = duplicates.map((d) => ({
    _id: d._id,
    leadId: d.leadId,
    name: d.name,
    phone: d.phone,
    email: d.email,
    assignedTo: d.assignedTo,
    createdAt: d.createdAt,
    status: d.status,
    statusReason: d.statusReason || '',
    daysAgo: Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86400000),
  }));

  const originalLead = matches.length
    ? [...matches].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
    : null;

  res.json({
    isDuplicate: matches.length > 0,
    matches,
    originalLead,
  });
});

const getTimeline = asyncHandler(async (req, res) => {
  const { getLeadViewerExtraFilter } = require('../services/leadAccessScope');
  const viewerFilter = await getLeadViewerExtraFilter(req);
  const lead = await Lead.findOne({
    _id: req.params.id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    isDeleted: { $ne: true },
    ...viewerFilter,
  }).select('_id');
  if (!lead) throw new ApiError(404, 'Lead not found');

  const result = await getLeadTimeline(lead._id, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
  });
  res.json(result);
});

const getAudit = asyncHandler(async (req, res) => {
  if (!['admin', 'sales_manager'].includes(req.user.role)) {
    throw new ApiError(403, 'Audit log access restricted');
  }
  const lead = await Lead.findOne({
    _id: req.params.id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).select('_id');
  if (!lead) throw new ApiError(404, 'Lead not found');

  const result = await getEntityAuditLog('lead', lead._id, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
  });
  res.json(result);
});

const listRecycleBin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {
    isDeleted: true,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  };
  const [rows, total] = await Promise.all([
    Lead.find(filter).populate(LEAD_POPULATE).sort({ deletedAt: -1 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  res.json(paginatedResponse(rows.map(enrichLead), { page, limit, total }));
});

const restoreLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.params.id,
    isDeleted: true,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(404, 'Deleted lead not found');

  lead.isDeleted = false;
  lead.deletedAt = null;
  lead.deletedBy = null;
  await lead.save();

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_restored',
    description: `Lead restored by ${req.user.name}`,
    actor: req.user,
  });
  await logAudit({
    entityType: 'lead',
    entityId: lead._id,
    branchId: lead.branchId,
    action: 'lead.restored',
    actor: req.user,
    ip: getClientIp(req),
  });

  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  res.json(enrichLead(populated));
});

const permanentDeleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.params.id,
    isDeleted: true,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(404, 'Deleted lead not found in recycle bin');
  await lead.deleteOne();
  res.json({ message: 'Lead permanently deleted' });
});

const getAgingAnalytics = asyncHandler(async (req, res) => {
  const match = { isDeleted: { $ne: true }, ...(req.branchId ? { branchId: req.branchId } : {}) };
  const buckets = await Lead.aggregate([
    { $match: match },
    { $group: { _id: '$agingBucket', count: { $sum: 1 } } },
  ]);
  const labels = { '0_7': '0-7 Days', '8_15': '8-15 Days', '16_30': '16-30 Days', '30_plus': '30+ Days' };
  res.json({
    buckets: buckets.map((b) => ({
      key: b._id,
      label: labels[b._id] || b._id,
      count: b.count,
    })),
  });
});

const listCallNotes = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.params.id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    isDeleted: { $ne: true },
  }).select('_id');
  if (!lead) throw new ApiError(404, 'Lead not found');

  const { page, limit, skip } = parsePagination(req.query);
  const filter = { leadId: lead._id };
  const [rows, total] = await Promise.all([
    CallNote.find(filter)
      .populate('userId', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CallNote.countDocuments(filter),
  ]);
  res.json(paginatedResponse(rows, { page, limit, total }));
});

const addCallNote = asyncHandler(async (req, res) => {
  const {
    outcome,
    notes,
    duration,
    durationSeconds,
    startedAt,
    endedAt,
    scheduleNextCall = true,
  } = req.body;
  if (!outcome) throw new ApiError(400, 'Call outcome / reason is required');

  const noteText = String(notes || '').trim();
  const lead = await Lead.findOne({
    _id: req.params.id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    isDeleted: { $ne: true },
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const endMs = endedAt ? new Date(endedAt).getTime() : NaN;
  const fromTimestamps =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
      ? Math.round((endMs - startMs) / 1000)
      : null;

  const role = req.user?.role;
  const isExecLike = role === 'sales_executive' || role === 'team_leader';
  // Executives cannot set/edit duration manually — only tracked dial→return window
  let seconds = 0;
  if (fromTimestamps != null) {
    seconds = Math.max(0, fromTimestamps);
  } else if (!isExecLike) {
    seconds = Math.max(0, Math.round(Number(durationSeconds ?? duration) || 0));
  }

  const callNote = await CallNote.create({
    leadId: lead._id,
    branchId: lead.branchId,
    userId: req.user._id,
    outcome,
    notes: noteText || `Call outcome: ${String(outcome).replace(/_/g, ' ')}`,
    duration: seconds,
    startedAt: startedAt ? new Date(startedAt) : undefined,
    endedAt: endedAt ? new Date(endedAt) : new Date(),
  });

  const now = new Date();
  if (!lead.firstContactAt) lead.firstContactAt = now;
  lead.lastContactedAt = now;
  lead.lastContactMethod = 'call';
  lead.lastContactedBy = req.user._id;
  const nextCount = Number(lead.callStats?.count || 0) + 1;
  const prevRecent = Array.isArray(lead.callStats?.recent) ? [...lead.callStats.recent] : [];
  prevRecent.push({
    n: nextCount,
    outcome: String(outcome || ''),
    duration: seconds,
    at: now,
  });
  lead.callStats = {
    count: nextCount,
    totalDurationSeconds: Number(lead.callStats?.totalDurationSeconds || 0) + seconds,
    lastCallAt: now,
    recent: prevRecent.slice(-12),
  };

  // Call picked / answered → move New leads into Connected (status: contacted)
  const outcomeKey = String(outcome || '');
  const notConnectedOutcomes = new Set(['no_answer']);
  const callConnected = !notConnectedOutcomes.has(outcomeKey);
  const prevStatus = lead.status;
  if (callConnected && lead.status === 'new') {
    lead.status = 'contacted';
  }

  await applyLeadMetrics(lead);
  await lead.save();

  let nextFollowUp = null;
  if (scheduleNextCall !== false && scheduleNextCall !== 'false') {
    try {
      const FollowUp = require('../models/FollowUp');
      const { createFollowUpForLead } = require('../services/followUpService');
      const { syncLeadFollowUpDates } = require('../utils/followUpHelpers');

      // 2nd/3rd call: complete prior auto "+2 hrs" reminders so the new timing becomes nextFollowUp
      await FollowUp.updateMany(
        {
          lead: lead._id,
          status: 'pending',
          type: 'call',
          notes: { $regex: /^Auto next call/i },
        },
        {
          $set: {
            status: 'completed',
            completedAt: now,
            outcome: 'auto_replaced',
          },
        }
      );

      const scheduledAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const followCategory = !callConnected
        ? 'call_not_picked'
        : outcomeKey === 'interested' || outcomeKey === 'discussed_package'
          ? 'warm'
          : 'call_picked';
      nextFollowUp = await createFollowUpForLead({
        body: {
          lead: lead._id,
          type: 'call',
          category: followCategory,
          notPickedReason: !callConnected ? 'not_answering' : undefined,
          scheduledAt: scheduledAt.toISOString(),
          notes: `Auto next call (2 hrs) after call — ${outcomeKey.replace(/_/g, ' ')}${noteText ? `: ${noteText.slice(0, 80)}` : ''}`,
          priority: lead.priority || 'medium',
        },
        user: req.user,
      });
      await syncLeadFollowUpDates(lead._id);
    } catch (err) {
      console.error('[addCallNote] next follow-up failed:', err.message);
    }
  }

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'call_note_added',
    description: `Call (${seconds}s): ${outcome.replace(/_/g, ' ')}${noteText ? ` — ${noteText.slice(0, 100)}` : ''}`,
    actor: req.user,
    meta: {
      callNoteId: callNote._id,
      outcome,
      durationSeconds: seconds,
      statusFrom: prevStatus,
      statusTo: lead.status,
      callConnected,
    },
  });
  await logAudit({
    entityType: 'lead',
    entityId: lead._id,
    branchId: lead.branchId,
    action: 'lead.call_note_added',
    actor: req.user,
    ip: getClientIp(req),
    meta: { outcome, durationSeconds: seconds, status: lead.status, callConnected },
  });

  const populated = await CallNote.findById(callNote._id).populate('userId', 'name role').lean();
  res.status(201).json({
    ...populated,
    nextFollowUp,
    callStats: lead.callStats,
    status: lead.status,
    callConnected,
  });
});

const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { leadIds, status, statusReason } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length) throw new ApiError(400, 'leadIds required');
  if (!status) throw new ApiError(400, 'status required');

  const LOST_STATUSES = ['lost', 'booked_from_another_company'];
  let normalizedLostReason = '';
  if (LOST_STATUSES.includes(status)) {
    const { assertValidLostReason } = require('../services/salesSopService');
    normalizedLostReason = assertValidLostReason(
      String(statusReason || '').trim() || (status === 'booked_from_another_company' ? 'booked_elsewhere' : ''),
      { requireComment: true }
    );
  }

  const { getLeadViewerExtraFilter } = require('../services/leadAccessScope');
  const viewerFilter = await getLeadViewerExtraFilter(req);

  const filter = {
    _id: { $in: leadIds },
    isDeleted: { $ne: true },
    ...(req.branchId ? { branchId: req.branchId } : {}),
    ...viewerFilter,
  };

  const leads = await Lead.find(filter);
  if (!leads.length) throw new ApiError(404, 'No matching leads found');

  const results = [];
  for (const lead of leads) {
    const prev = lead.status;
    lead.status = status;
    if (normalizedLostReason) {
      lead.statusReason = normalizedLostReason;
      lead.statusReasonUpdatedAt = new Date();
    }
    await applyLeadMetrics(lead);
    await lead.save();
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'status_changed',
      description: `Status changed from ${prev} to ${status} (bulk)`,
      actor: req.user,
      meta: { from: prev, to: status, statusReason: normalizedLostReason || undefined },
    });
    results.push({ _id: lead._id, status: lead.status });
  }

  res.json({ updated: results.length, leads: results });
});

const bulkExportLeads = asyncHandler(async (req, res) => {
  const { leadIds } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length) throw new ApiError(400, 'leadIds required');

  const { getLeadViewerExtraFilter } = require('../services/leadAccessScope');
  const viewerFilter = await getLeadViewerExtraFilter(req);

  const filter = {
    _id: { $in: leadIds },
    isDeleted: { $ne: true },
    ...(req.branchId ? { branchId: req.branchId } : {}),
    ...viewerFilter,
  };

  const leads = await Lead.find(filter).populate(LEAD_POPULATE).lean();
  const headers = [
    'Lead ID', 'Name', 'Phone', 'Email', 'Destination', 'Status',
    'Budget', 'Pax', 'Source', 'Assigned To', 'Smart Score', 'Temperature', 'Created',
  ];

  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = leads.map((l) => {
    const enriched = enrichLead(l);
    return [
      enriched.leadId || l._id,
      l.name,
      l.phone,
      l.email,
      l.destination,
      l.status,
      l.budget,
      l.pax,
      enriched.sourceLabel || l.source,
      l.assignedTo?.name || '',
      l.smartScore,
      l.temperature,
      l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '',
    ].map(escape).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.csv"`);
  res.send(csv);
});

const mergeDuplicateLeads = asyncHandler(async (req, res) => {
  const { sourceLeadId, targetLeadId } = req.body;
  if (!sourceLeadId || !targetLeadId) throw new ApiError(400, 'sourceLeadId and targetLeadId are required');

  const { target, moved } = await mergeLeads({
    sourceLeadId,
    targetLeadId,
    actor: req.user,
    branchId: req.branchId,
    ip: getClientIp(req),
  });

  const populated = await Lead.findById(target._id).populate(LEAD_POPULATE).lean();
  res.json({ message: 'Leads merged successfully', lead: enrichLead(populated), moved });
});

const getTransferHistory = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.params.id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).select('_id');
  if (!lead) throw new ApiError(404, 'Lead not found');

  const result = await getLeadTransferHistory(lead._id, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 30,
  });
  res.json(result);
});

const getSourceAnalyticsHandler = asyncHandler(async (req, res) => {
  const result = await getSourceAnalytics(req.branchId);
  res.json(result);
});

const getExecutivePerformanceHandler = asyncHandler(async (req, res) => {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
  const source = typeof req.query.source === 'string' ? req.query.source : '';
  const result = await getExecutivePerformance(req.branchId, {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    source: source || undefined,
  });
  res.json(result);
});

const getKpis = asyncHandler(async (req, res) => {
  const result = await getEnterpriseKpis(req.branchId);
  res.json(result);
});

const getSlaAnalytics = asyncHandler(async (req, res) => {
  const result = await getSlaDashboard(req.branchId, {
    tab: req.query.tab || 'breached',
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  });
  res.json(result);
});

const listAuditLog = asyncHandler(async (req, res) => {
  if (!['admin', 'sales_manager'].includes(req.user.role)) {
    throw new ApiError(403, 'Audit log access restricted');
  }
  const result = await listBranchAuditLogs(req.branchId, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
    action: req.query.action,
    entityType: req.query.entityType || 'lead',
  });
  res.json(result);
});

module.exports = {
  checkDuplicate,
  getTimeline,
  getAudit,
  listRecycleBin,
  restoreLead,
  permanentDeleteLead,
  getAgingAnalytics,
  listCallNotes,
  addCallNote,
  bulkUpdateStatus,
  bulkExportLeads,
  mergeDuplicateLeads,
  getTransferHistory,
  getSourceAnalyticsHandler,
  getExecutivePerformanceHandler,
  getKpis,
  getSlaAnalytics,
  listAuditLog,
};
