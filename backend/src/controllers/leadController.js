const Lead = require('../models/Lead');
const LeadNote = require('../models/LeadNote');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Branch = require('../models/Branch');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { LEAD_STATUSES, REACTIVATION_STAGES } = require('../models/Lead');
const { logActivity, getClientIp } = require('../services/activityService');
const {
  notifyLeadCreated,
  notifyLeadAssigned,
  notifyLeadReactivated,
  notifyLeadReassigned,
  notifyReactivationProgress,
  parseAndNotifyMentions,
} = require('../services/notificationService');
const { loadLeadCore, loadLeadFollowups, loadLeadQuotations, loadLeadNotes, loadLeadRelated } = require('../services/leadDetailService');
const { LEAD_POPULATE, LEAD_LIST_POPULATE, enrichLead, buildLeadSearchFilter } = require('../utils/queryHelpers');
const { LEAD_LIST_SELECT } = require('../utils/leadQueryFields');
const { getLeadListKpis } = require('../services/leadListKpiService');
const { createFollowUpForLead } = require('../services/followUpService');
const { scheduleColdLeadReminder, markColdCallDone } = require('../services/coldLeadService');
const { normalizeLeadInput, computeLeadScoreByBudget } = require('../utils/normalizeLeadInput');
const { ROLE_LABELS } = require('../config/roles');
const { findLeadsPaginated } = require('../repositories/leadRepository');
const { invalidate: invalidateDashboardCache } = require('../services/dashboardCacheService');
const { onLeadConverted, isLeadStatusLocked } = require('../services/leadConversionService');
const {
  getLeadPaymentSummary,
  getLeadPaymentReceipt,
  sendReceiptToCustomer,
  generateAndStoreReceipt,
} = require('../services/paymentReceiptService');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { runLeadAutoAssignment } = require('../services/leadAutoAssignmentService');
const { isLeadAutoAssignmentEnabled } = require('../config/assignment');
const { detectLeadType } = require('../services/leadTypeDetectionService');
const { DEMO_LEADS } = require('../data/demoLeads');
const { clearAllLeadsData } = require('../services/clearAllLeadsService');
const {
  buildAssignmentPatch,
  assertCanAssignLeads,
  getAssigneesForUser,
} = require('../services/leadAssignmentService');
const { setReactivationStage } = require('../services/reactivationService');
const { logLeadActivity } = require('../services/leadActivityService');
const { logLeadTransfer } = require('../services/leadTransferService');
const { stampPendingAcceptance } = require('../services/leadExecutiveStallService');
const { invalidateExecutiveLeadIdsCache } = require('../services/executiveScopeService');
const { logAudit, diffLeadChanges, formatLeadChangeDescription, formatStatusChangeDescription } = require('../services/leadAuditService');
const { applyLeadMetrics } = require('../services/leadScoringService');
const { findDuplicateLeads } = require('../services/duplicateDetectionService');
const {
  getLeaderLeadScopeFilter,
  getExecutiveIdsForLeader,
} = require('../services/teamScopeService');
const {
  getLeadViewerExtraFilter,
  isRestrictedLeadViewer,
} = require('../services/leadAccessScope');
const {
  findExecutiveLeadsPaginated,
  findTeamLeaderLeadsPaginated,
} = require('../repositories/roleScopedRepository');
const Team = require('../models/Team');

async function loadAccessibleLeadCore(req, leadId) {
  const extraFilter = await getLeadViewerExtraFilter(req);
  return loadLeadCore(leadId, { branchId: req.branchId, extraFilter });
}

async function findAccessibleLeadDoc(req, leadId, extra = {}) {
  const viewerFilter = await getLeadViewerExtraFilter(req);
  return Lead.findOne({
    _id: leadId,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    ...viewerFilter,
    ...extra,
  });
}

const LOST_LEAD_STATUSES = ['lost', 'booked_from_another_company'];
const WORKING_PIPELINE_STATUSES = ['working_progress', 'qualified', 'follow_up', 'quotation_sent', 'negotiation', 'reactivated', 'converted'];
const REACTIVATION_STATUS_TO_STAGE = {
  contacted: 'contacted',
  follow_up: 'follow_up_scheduled',
  quotation_sent: 'quotation_sent',
  converted: 'converted',
};

const REACTIVATION_MANAGER_ROLES = ['admin', 'sales_manager', 'team_leader'];

async function resolveReactivationExecutive(req, executiveId) {
  const id = String(executiveId || '').trim();
  if (!id) throw new ApiError(400, 'Executive selection is required to reactivate');

  const executive = await User.findOne({
    _id: id,
    role: 'sales_executive',
    status: 'active',
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).select('name email');

  if (!executive) throw new ApiError(404, 'Executive not found');

  if (req.user.role === 'team_leader') {
    const execIds = await getExecutiveIdsForLeader(req.user._id);
    if (!execIds.includes(String(executive._id))) {
      throw new ApiError(403, 'You can only assign to executives in your team');
    }
  }

  return executive;
}

async function assignReactivatedLeadToExecutive(lead, executive, actor, note = '') {
  lead.assignedTo = executive._id;
  lead.assigneeRole = 'sales_executive';
  stampPendingAcceptance(lead, lead);

  if (actor.role === 'team_leader') {
    const team = await Team.findOne({ teamLeader: actor._id }).select('_id');
    if (team?._id) {
      lead.teamId = team._id;
      lead.assignedTeamLeader = actor._id;
    }
  }

  lead.reactivation = lead.reactivation || {};
  lead.reactivation.reassignedTo = executive._id;
  lead.reactivation.reassignedBy = actor._id;
  lead.reactivation.reassignedAt = new Date();
  setReactivationStage(
    lead,
    'reassigned',
    actor._id,
    note || `Assigned to ${executive.name}`
  );
}

async function assertLeadReactivationAccess(req, lead) {
  if (!REACTIVATION_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'You do not have permission to manage lead reactivation');
  }
  if (req.branchId && lead.branchId && String(lead.branchId) !== String(req.branchId)) {
    throw new ApiError(403, 'Lead is outside your branch');
  }
  if (req.user.role === 'team_leader') {
    const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
    const inScope = await Lead.exists({
      _id: lead._id,
      ...squadFilter,
      ...(req.branchId ? { branchId: req.branchId } : {}),
    });
    if (!inScope) throw new ApiError(403, 'Lead is outside your team');
  }
}

function ensureLeadQualifiedForPipeline() {
  // Budget is optional — leads can move through pipeline without a set budget.
}

const listLeads = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (role === 'sales_executive') {
    const result = await findExecutiveLeadsPaginated(req.user._id, req.query, {
      branchId: req.branchId,
    });
    return res.json(result);
  }
  if (role === 'team_leader') {
    const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
    const result = await findTeamLeaderLeadsPaginated(squadFilter, req.query, {
      branchId: req.branchId,
    });
    return res.json(result);
  }
  const result = await findLeadsPaginated(req.query, { branchId: req.branchId });
  res.json(result);
});

const getLead = asyncHandler(async (req, res) => {
  const lead = await loadAccessibleLeadCore(req, req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  const paymentSummary = await getLeadPaymentSummary(lead._id);

  const includeRelated = req.query.includeRelated === '1' || req.query.includeRelated === 'true';
  if (!includeRelated) {
    res.json({ ...enrichLead(lead), paymentSummary });
    return;
  }

  const related = await loadLeadRelated(lead._id, {
    branchId: req.branchId,
    followupsLimit: req.query.followupsLimit,
  });
  res.json({ ...enrichLead(lead), ...related, paymentSummary });
});

const getLeadPaymentReceiptDoc = asyncHandler(async (req, res) => {
  const extraFilter = await getLeadViewerExtraFilter(req);
  const data = await getLeadPaymentReceipt(req.params.id, {
    branchId: req.branchId,
    extraFilter,
  });
  res.json(data);
});

const sendLeadPaymentReceipt = asyncHandler(async (req, res) => {
  const lead = await loadAccessibleLeadCore(req, req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  let payment = await Payment.findOne({ lead: lead._id }).sort({ createdAt: -1 });
  if (!payment) throw new ApiError(404, 'No payment found for this lead');

  const booking = await Booking.findOne({ lead: lead._id }).sort({ createdAt: -1 }).lean();
  const quotation = payment.quotation
    ? await Quotation.findById(payment.quotation).lean()
    : null;

  if (!payment.receiptHtml) {
    payment = await generateAndStoreReceipt({
      lead,
      payment,
      booking,
      quotation,
      actor: req.user,
    });
  }

  const result = await sendReceiptToCustomer({ lead, payment, actor: req.user });
  res.json(result);
});

const getLeadFollowups = asyncHandler(async (req, res) => {
  const lead = await loadAccessibleLeadCore(req, req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadFollowups(lead._id, { branchId: req.branchId, query: req.query });
  res.json(result);
});

const getLeadQuotations = asyncHandler(async (req, res) => {
  const lead = await loadAccessibleLeadCore(req, req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadQuotations(lead._id, { branchId: req.branchId, query: req.query });
  res.json(result);
});

const getLeadNotesList = asyncHandler(async (req, res) => {
  const lead = await loadAccessibleLeadCore(req, req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadNotes(lead._id, { query: req.query });
  res.json(result);
});

const listLostLeads = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (role === 'sales_executive') {
    const result = await findExecutiveLeadsPaginated(
      req.user._id,
      { ...req.query, filter: 'lost' },
      { branchId: req.branchId }
    );
    return res.json(result);
  }
  if (role === 'team_leader') {
    const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
    const result = await findTeamLeaderLeadsPaginated(
      squadFilter,
      { ...req.query, filter: 'lost' },
      { branchId: req.branchId }
    );
    return res.json(result);
  }
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {
    ...(req.branchId ? { branchId: req.branchId } : {}),
    isDeleted: { $ne: true },
    status: { $in: LOST_LEAD_STATUSES },
    ...buildLeadSearchFilter(req.query.search),
  };
  const [rows, total] = await Promise.all([
    Lead.find(filter)
      .select(LEAD_LIST_SELECT)
      .populate(LEAD_LIST_POPULATE)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);
  res.json(paginatedResponse(rows.map(enrichLead), { page, limit, total }));
});

const getListKpis = asyncHandler(async (req, res) => {
  if (isRestrictedLeadViewer(req.user.role)) {
    return res.json({
      totalLeads: 0,
      todayLeads: 0,
      newLeads: 0,
      statusNewLeads: 0,
      unassignedLeads: 0,
      assignedLeads: 0,
      followUpPending: 0,
      lostLeads: 0,
      convertedLeads: 0,
      duplicateLeads: 0,
    });
  }
  const data = await getLeadListKpis(req.branchId);
  res.json(data);
});

const createLead = asyncHandler(async (req, res) => {
  const status = req.body.status || 'new';
  if (!LEAD_STATUSES.includes(status)) {
    throw new ApiError(400, 'Invalid lead status');
  }

  const data = normalizeLeadInput(req.body);
  if (!data.name?.trim() || !data.phone?.trim()) {
    throw new ApiError(400, 'Customer name and phone are required');
  }
  if (req.user.role === 'sales_executive') {
    const blocked = new Set(['dpw', 'organic', 'website', 'google_ads']);
    if (blocked.has(data.source) || blocked.has(data.leadSource)) {
      throw new ApiError(400, 'This lead source is not available for sales executives');
    }
  }
  if (!data.destination?.trim()) {
    data.destination = 'Not specified';
  }
  const typeDetection = detectLeadType({ ...req.body, ...data });
  data.leadType = typeDetection.leadType;
  data.leadTypeSource = typeDetection.leadTypeSource;

  data.status = status;
  data.createdBy = req.user._id;
  if (req.user.role === 'admin' && req.body.branchId) {
    const branch = await Branch.findById(req.body.branchId).select('_id status');
    if (!branch || branch.status !== 'active') {
      throw new ApiError(400, 'Invalid branch selected');
    }
    data.branchId = branch._id;
  } else {
    data.branchId = req.branchId || req.user.branchId || null;
  }
  // Sales executives who create a lead own it immediately (admin can see their name).
  if (!data.assignedTo && req.user.role === 'sales_executive') {
    data.assignedTo = req.user._id;
    data.assigneeRole = 'sales_executive';
    stampPendingAcceptance(data, data);
  }

  const prior = await findDuplicateLeads({
    phone: data.phone,
    alternatePhone: data.alternatePhone,
    branchId: data.branchId,
  });
  if (prior.length) {
    data.isRepeatCustomer = true;
  }

  await applyLeadMetrics(data);
  const lead = await Lead.create(data);

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_created',
    description: data.isRepeatCustomer
      ? `Repeated lead created from ${data.sourceLabel || data.source || 'CRM'} (matching phone)`
      : `Lead created from ${data.sourceLabel || data.source || 'CRM'}`,
    actor: req.user,
    meta: { source: data.source, isRepeatCustomer: Boolean(data.isRepeatCustomer) },
  });
  await logAudit({
    entityType: 'lead',
    entityId: lead._id,
    branchId: lead.branchId,
    action: 'lead.created',
    actor: req.user,
    ip: getClientIp(req),
  });

  const shouldAutoAssign =
    !data.assignedTo &&
    req.user.role !== 'sales_executive' &&
    req.body.skipAutoAssign !== true &&
    lead.branchId;

  if (shouldAutoAssign && (await isLeadAutoAssignmentEnabled())) {
    await runLeadAutoAssignment(lead, { triggeredBy: req.user });
  }

  if (data.nextFollowUp) {
    await createFollowUpForLead({
      body: {
        lead: lead._id,
        scheduledAt: new Date(data.nextFollowUp).toISOString(),
        notes: data.followUpRemarks || '',
        category: 'warm',
      },
      user: req.user,
    });
  }

  await logActivity({
    type: 'lead_created',
    user: req.user.name,
    userId: req.user._id,
    action: `Created lead ${lead.leadId || lead.name}`,
    target: lead.name,
    ip: getClientIp(req),
    branchId: lead.branchId || req.branchId || null,
  });

  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  const enriched = enrichLead(populated);
  invalidateDashboardCache('admin');
  invalidateDashboardCache('lead-list-kpis');
  notifyLeadCreated(enriched, req.user).catch(() => {});
  res.status(201).json(enriched);
});

const seedDemoLeads = asyncHandler(async (req, res) => {
  let branchId = req.branchId || req.user.branchId;
  if (!branchId) {
    const branch = await Branch.findOne({ status: 'active' }).sort({ createdAt: 1 }).select('_id');
    branchId = branch?._id;
  }
  if (!branchId) throw new ApiError(400, 'No active branch found. Create a branch first.');

  const existing = await Lead.countDocuments({ branchId, channel: 'demo_seed' });
  if (existing >= 10) {
    throw new ApiError(400, '10 demo leads already exist for this branch. Delete them first to re-seed.');
  }

  const followUpBase = new Date();
  followUpBase.setDate(followUpBase.getDate() + 1);
  followUpBase.setHours(11, 0, 0, 0);

  const created = [];
  const templates = DEMO_LEADS.slice(0, 10 - existing);

  for (let i = 0; i < templates.length; i += 1) {
    const template = templates[i];
    const travelDate = new Date();
    travelDate.setDate(travelDate.getDate() + 20 + i * 3);

    const nextFollowUp = new Date(followUpBase);
    nextFollowUp.setHours(nextFollowUp.getHours() + i);

    const typeDetection = detectLeadType(template);
    const lead = await Lead.create({
      ...template,
      status: 'new',
      leadType: typeDetection.leadType,
      leadTypeSource: typeDetection.leadTypeSource,
      travelDate,
      budgetRange: template.budget >= 100000 ? 'above_100000' : 'custom',
      leadScore: template.isHot ? 'hot' : computeLeadScoreByBudget(template.budget),
      createdBy: req.user._id,
      branchId,
      channel: 'demo_seed',
      nextFollowUp,
    });

    await createFollowUpForLead({
      body: {
        lead: lead._id,
        scheduledAt: nextFollowUp.toISOString(),
        notes: 'Demo follow-up — first contact',
        category: 'warm',
      },
      user: req.user,
    });

    created.push(lead._id);
  }

  await logActivity({
    type: 'lead_created',
    user: req.user.name,
    userId: req.user._id,
    action: `Added ${created.length} demo leads`,
    target: 'New Leads',
    ip: getClientIp(req),
    branchId,
  });

  invalidateDashboardCache('admin');

  res.status(201).json({
    message: `${created.length} demo lead(s) added to New Leads`,
    created: created.length,
    totalDemoLeads: existing + created.length,
  });
});

const clearAllLeads = asyncHandler(async (req, res) => {
  const deleted = await clearAllLeadsData();

  await logActivity({
    type: 'lead_action',
    user: req.user.name,
    userId: req.user._id,
    action: 'Cleared all leads from CRM',
    target: `${deleted.leads} leads removed`,
    ip: getClientIp(req),
    branchId: req.branchId || req.user.branchId || null,
  });

  res.json({
    message: 'All leads and related data have been deleted',
    deleted,
  });
});

const updateLead = asyncHandler(async (req, res) => {
  const lead = await findAccessibleLeadDoc(req, req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  if (req.body.status && !LEAD_STATUSES.includes(req.body.status)) {
    throw new ApiError(400, 'Invalid lead status');
  }

  const prevStatus = lead.status;
  const before = lead.toObject();
  const data = normalizeLeadInput(req.body, { isUpdate: true });
  const nextStatus = data.status || lead.status;
  if (nextStatus === 'qualified') {
    const { getMissingQualificationFields } = require('../services/salesSopService');
    const probe = { ...lead.toObject(), ...data };
    const missing = getMissingQualificationFields(probe);
    if (missing.length) {
      throw new ApiError(
        400,
        `Qualified means genuine buyer + requirements confirmed. Complete: ${missing.join(', ')}`
      );
    }
  }
  const effectivePayload = {
    budget: data.budget ?? lead.budget,
    nextFollowUp: data.nextFollowUp ?? lead.nextFollowUp,
  };
  if (WORKING_PIPELINE_STATUSES.includes(nextStatus)) {
    ensureLeadQualifiedForPipeline(effectivePayload);
  }
  if (data.status && LOST_LEAD_STATUSES.includes(data.status)) {
    const { assertValidLostReason } = require('../services/salesSopService');
    const incoming = data.statusReason?.trim() || '';
    const reasonValue = assertValidLostReason(
      incoming || (data.status === 'booked_from_another_company' ? 'booked_elsewhere' : ''),
      { requireComment: true }
    );
    data.statusReason = reasonValue;
  }
  if (data.status && data.status !== prevStatus && isLeadStatusLocked(prevStatus)) {
    throw new ApiError(400, 'Lead status cannot be changed after conversion or closure');
  }

  const prevTemperature = lead.temperature;
  const wasColdBeforeAssign =
    String(lead.temperature || '').toLowerCase() === 'cold' ||
    [
      'booked_elsewhere',
      'language_barrier',
      'not_interested',
      'invalid_number',
      'budget_issues',
      'budget_issue',
    ].includes(
      String(lead.statusReason || '')
        .trim()
        .split(/\s*[—–]\s*|\s+-\s+/)[0]
        ?.replace(/:$/, '')
        .trim()
    ) ||
    Boolean(lead.coldReason);

  // Cold → Warm: keep pipeline status working_progress; stamp user option or cold_to_warm
  if (
    (data.temperature === 'warm' || req.body.fromColdToWarm === true) &&
    wasColdBeforeAssign &&
    data.status &&
    !['converted', 'lost', 'booked_from_another_company'].includes(data.status)
  ) {
    data.status = 'working_progress';
    const reasonHead = String(data.statusReason || '')
      .split(/\s*[—–]\s*|\s+-\s+/)[0]
      ?.replace(/:$/, '')
      .trim();
    if (!reasonHead || ['working_progress', 'auto_connected_24h', 'cold_to_warm'].includes(reasonHead)) {
      data.statusReason = req.body.warmOption
        ? String(req.body.warmOption).trim()
        : 'cold_to_warm';
    }
    data.coldReason = undefined;
  }

  Object.assign(lead, data);
  if (data.temperature === 'warm' || data.status === 'working_progress') {
    lead.coldReason = undefined;
  }
  if (data.status === 'converted' && prevStatus !== 'converted' && !lead.convertedAt) {
    lead.convertedAt = new Date();
  }
  if (!lead.firstContactAt && (data.status === 'contacted' || ['contacted', 'working_progress', 'qualified', 'follow_up'].includes(nextStatus))) {
    lead.firstContactAt = new Date();
    if (!lead.slaContactedAt) lead.slaContactedAt = lead.firstContactAt;
  }
  if (data.status && lead.reactivation?.isReactivated) {
    const nextStage = REACTIVATION_STATUS_TO_STAGE[data.status];
    if (nextStage) {
      setReactivationStage(lead, nextStage, req.user._id, `Status changed from ${prevStatus} to ${data.status}`);
    }
  }
  await applyLeadMetrics(lead);
  await lead.save();

  const markedCold =
    data.temperature === 'cold' ||
    (req.body.temperature === 'cold') ||
    Boolean(req.body.coldReason && String(req.body.coldReason).trim());
  const coldCallDone = req.body.coldCallDone === true || req.body.coldCallDone === 'true';

  if (coldCallDone) {
    await markColdCallDone(lead, {
      user: req.user,
      notes: req.body.coldCallNotes || req.body.statusReason || 'Cold call done',
    });
  } else if (markedCold && (prevTemperature !== 'cold' || req.body.coldReason)) {
    await scheduleColdLeadReminder(lead, {
      reason: req.body.coldReason || data.coldReason || lead.coldReason,
      user: req.user,
      notes: req.body.coldCallNotes || req.body.statusReason || '',
    });
  }

  const changes = diffLeadChanges(before, lead.toObject());
  if (changes.length) {
    await logAudit({
      entityType: 'lead',
      entityId: lead._id,
      branchId: lead.branchId,
      action: data.status && data.status !== prevStatus ? 'lead.status_changed' : 'lead.updated',
      actor: req.user,
      changes,
      ip: getClientIp(req),
    });
  }
  if (data.status && data.status !== prevStatus) {
    const typeMap = {
      lost: 'lead_lost',
      booked_from_another_company: 'lead_lost',
      converted: 'lead_converted',
      reactivated: 'lead_reactivated',
    };
    const after = lead.toObject();
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: typeMap[data.status] || 'status_changed',
      description: formatStatusChangeDescription({
        fromStatus: prevStatus,
        toStatus: data.status,
        fromTemperature: prevTemperature,
        toTemperature: after.temperature,
        fromReason: before.statusReason,
        toReason: after.statusReason,
        fromColdToWarm: wasColdBeforeAssign && data.status === 'working_progress',
      }),
      actor: req.user,
      meta: {
        from: prevStatus,
        to: data.status,
        fromTemperature: prevTemperature || undefined,
        toTemperature: after.temperature || undefined,
        fromReason: before.statusReason || undefined,
        toReason: after.statusReason || undefined,
        changes: changes.filter((c) =>
          ['status', 'statusReason', 'temperature', 'coldReason', 'isHot'].includes(c.field)
        ),
      },
    });
  } else if (changes.length) {
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'lead_edited',
      description: formatLeadChangeDescription(changes),
      actor: req.user,
      meta: { changes },
    });
  }

  if (data.status && lead.reactivation?.isReactivated) {
    const nextStage = REACTIVATION_STATUS_TO_STAGE[data.status];
    if (nextStage) {
      notifyReactivationProgress({ lead, actor: req.user, stage: nextStage }).catch(() => {});
    }
  }

  if (data.status === 'converted' && prevStatus !== 'converted') {
    const hasMulti =
      Array.isArray(req.body.paymentScreenshots) &&
      req.body.paymentScreenshots.some((s) => s?.base64);
    if (!req.body.paymentScreenshotBase64 && !hasMulti) {
      throw new ApiError(400, 'Upload payment screenshot (UPI / bank transfer proof)');
    }
    await onLeadConverted(lead, req.user, {
      advanceAmount: req.body.advanceAmount ?? req.body.tokenAmount,
      paymentMethod: req.body.paymentMethod,
      sendReceipt: req.body.sendReceipt !== false,
      paymentScreenshotBase64: req.body.paymentScreenshotBase64,
      paymentScreenshotName: req.body.paymentScreenshotName,
      paymentScreenshots: req.body.paymentScreenshots,
    }).catch((err) => {
      console.error('[LeadConversion]', err.message);
    });
  } else if (data.status && data.status !== prevStatus) {
    invalidateDashboardCache('admin');
    invalidateDashboardCache('sales_manager');
    invalidateDashboardCache('team_leader');
    invalidateDashboardCache('sales_executive');
    invalidateDashboardCache('nav:');
    invalidateDashboardCache('lead-list-kpis');
  }

  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  const paymentSummary = await getLeadPaymentSummary(lead._id);
  res.json({ ...enrichLead(populated), paymentSummary });
});

const deleteLead = asyncHandler(async (req, res) => {
  const lead = await findAccessibleLeadDoc(req, req.params.id, { isDeleted: { $ne: true } });
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (LOST_LEAD_STATUSES.includes(lead.status)) {
    throw new ApiError(400, 'Lost leads cannot be deleted');
  }
  lead.isDeleted = true;
  lead.deletedAt = new Date();
  lead.deletedBy = req.user._id;
  await lead.save();

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_deleted',
    description: `Lead moved to recycle bin by ${req.user.name}`,
    actor: req.user,
  });
  await logAudit({
    entityType: 'lead',
    entityId: lead._id,
    branchId: lead.branchId,
    action: 'lead.deleted',
    actor: req.user,
    ip: getClientIp(req),
  });

  res.json({ message: 'Lead moved to recycle bin' });
});

const reactivateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!lead) throw new ApiError(404, 'Lead not found');
  await assertLeadReactivationAccess(req, lead);
  if (!LOST_LEAD_STATUSES.includes(lead.status)) {
    throw new ApiError(400, 'Only lost leads can be reactivated');
  }

  const reason = (req.body.reason || '').trim();
  if (!reason) throw new ApiError(400, 'Reactivation reason is required');

  const executive = await resolveReactivationExecutive(req, req.body.executiveId);

  const previousStatus = lead.status;
  lead.status = 'reactivated';
  lead.statusReason = reason;
  lead.statusReasonUpdatedAt = new Date();
  lead.reactivation = lead.reactivation || {};
  lead.reactivation.isReactivated = true;
  lead.reactivation.previousLostStatus = previousStatus;
  lead.reactivation.reactivatedAt = new Date();
  lead.reactivation.reactivatedBy = req.user._id;
  lead.reactivation.reactivatedReason = reason;
  setReactivationStage(lead, 'reactivated', req.user._id, reason);
  await assignReactivatedLeadToExecutive(
    lead,
    executive,
    req.user,
    `Reactivated and assigned to ${executive.name}`
  );

  await lead.save();
  invalidateDashboardCache('admin');
  invalidateDashboardCache('sales_manager');
  invalidateDashboardCache('team_leader');
  invalidateDashboardCache('sales_executive');
  await logActivity({
    type: 'lead_reactivated',
    user: req.user.name,
    userId: req.user._id,
    action: `Reactivated lead ${lead.leadId || lead.name} and assigned to ${executive.name}`,
    target: lead.name,
    ip: getClientIp(req),
    branchId: lead.branchId || req.branchId || null,
    meta: { leadId: lead._id, reason, executiveId: executive._id },
  });
  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_reactivated',
    description: `Reactivated and assigned to ${executive.name} — ${reason}`,
    actor: req.user,
    meta: { reason, executiveId: executive._id, previousStatus },
  }).catch(() => {});
  notifyLeadReactivated({ lead, actor: req.user, assigneeId: executive._id }).catch(() => {});
  notifyLeadReassigned({
    lead,
    actor: req.user,
    assigneeId: executive._id,
    assigneeName: executive.name,
  }).catch(() => {});
  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  res.json(enrichLead(populated));
});

const reassignReactivatedLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!lead) throw new ApiError(404, 'Lead not found');
  await assertLeadReactivationAccess(req, lead);
  if (!lead.reactivation?.isReactivated || lead.status !== 'reactivated') {
    throw new ApiError(400, 'Lead is not in reactivated state');
  }

  const executive = await resolveReactivationExecutive(req, req.body.executiveId);

  await assignReactivatedLeadToExecutive(lead, executive, req.user, `Assigned to ${executive.name}`);
  await lead.save();

  invalidateDashboardCache('sales_executive');
  await logActivity({
    type: 'lead_reactivation_reassigned',
    user: req.user.name,
    userId: req.user._id,
    action: `Reassigned reactivated lead ${lead.leadId || lead.name} to ${executive.name}`,
    target: lead.name,
    ip: getClientIp(req),
    branchId: lead.branchId || req.branchId || null,
    meta: { leadId: lead._id, executiveId: executive._id },
  });
  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_reassigned',
    description: `Reactivated lead reassigned to ${executive.name}`,
    actor: req.user,
    meta: { executiveId: executive._id },
  }).catch(() => {});
  notifyLeadReassigned({
    lead,
    actor: req.user,
    assigneeId: executive._id,
    assigneeName: executive.name,
  }).catch(() => {});

  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  res.json(enrichLead(populated));
});

const updateReactivationStage = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!lead) throw new ApiError(404, 'Lead not found');
  await assertLeadReactivationAccess(req, lead);
  if (!lead.reactivation?.isReactivated) throw new ApiError(400, 'Lead is not reactivated');
  const stage = req.body.stage;
  if (!REACTIVATION_STAGES.includes(stage)) throw new ApiError(400, 'Invalid reactivation stage');

  setReactivationStage(lead, stage, req.user._id, (req.body.note || '').trim());
  if (stage === 'contacted') lead.status = 'contacted';
  if (stage === 'follow_up_scheduled') lead.status = 'follow_up';
  if (stage === 'quotation_sent') lead.status = 'quotation_sent';
  if (stage === 'converted') {
    lead.status = 'converted';
    if (!lead.convertedAt) lead.convertedAt = new Date();
  }
  await lead.save();

  await logActivity({
    type: 'lead_reactivation_progress',
    user: req.user.name,
    userId: req.user._id,
    action: `Updated reactivation stage to ${stage}`,
    target: lead.name,
    ip: getClientIp(req),
    branchId: lead.branchId || req.branchId || null,
    meta: { leadId: lead._id, stage },
  });
  notifyReactivationProgress({ lead, actor: req.user, stage }).catch(() => {});
  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  res.json(enrichLead(populated));
});

const getAssignees = asyncHandler(async (req, res) => {
  const payload = await getAssigneesForUser(req);
  res.json(payload);
});

const assignLeads = asyncHandler(async (req, res) => {
  const { leadIds, assigneeRole, assigneeId } = req.body;
  const ids = leadIds || (req.body.leadId ? [req.body.leadId] : []);

  if (!ids.length) throw new ApiError(400, 'No leads selected');
  if (!assigneeRole || !assigneeId) throw new ApiError(400, 'Assignee role and user are required');

  const { assignee, branchId, teamId } = await assertCanAssignLeads(req, {
    leadIds: ids,
    assigneeRole,
    assigneeId,
  });

  const patch = buildAssignmentPatch(assigneeRole, assignee);
  if (teamId && assigneeRole === 'sales_executive') {
    patch.teamId = teamId;
    patch.assignedTeamLeader = req.user._id;
  }

  const leadsBefore = await Lead.find({
    _id: { $in: ids },
    ...(branchId ? { branchId } : {}),
    isDeleted: { $ne: true },
  }).select('_id assignedTo branchId');

  await Lead.updateMany(
    { _id: { $in: ids }, ...(branchId ? { branchId } : {}), isDeleted: { $ne: true } },
    patch
  );

  if (assigneeRole === 'sales_executive') {
    await invalidateExecutiveLeadIdsCache(assigneeId, branchId);
  }

  const transferType = ids.length > 1 ? 'bulk_assign' : 'assign';
  await Promise.all(
    leadsBefore.map((lead) =>
      Promise.all([
        logLeadActivity({
          leadId: lead._id,
          branchId: branchId || req.branchId,
          type: lead.assignedTo ? 'lead_reassigned' : 'lead_assigned',
          description: `Assigned to ${assignee.name}`,
          actor: req.user,
          meta: { assigneeId: assignee._id, role: assigneeRole },
        }),
        logLeadTransfer({
          leadId: lead._id,
          branchId: lead.branchId || branchId || req.branchId,
          type: transferType,
          actor: req.user,
          fromUserId: lead.assignedTo || null,
          toUserId: assignee._id,
          note: `Assigned to ${assignee.name} (${assigneeRole})`,
          meta: { assigneeRole },
        }),
      ])
    )
  );

  await logActivity({
    type: 'lead_assigned',
    user: req.user.name,
    userId: req.user._id,
    action: `Assigned ${ids.length} lead(s) to ${assignee.name}`,
    target: assignee.name,
    ip: getClientIp(req),
    branchId: req.branchId || req.user.branchId || null,
  });

  notifyLeadAssigned({
    assigneeId: assignee._id,
    assigneeName: assignee.name,
    leadIds: ids,
    assignedBy: req.user,
    assigneeRole,
  }).catch(() => {});

  res.json({
    message: 'Leads assigned',
    count: ids.length,
    assignee: assignee.name,
    role: assigneeRole,
  });
});

const transferLeadBranch = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admin can transfer lead branch');
  }

  const targetBranchId = String(req.body.branchId || '').trim();
  if (!targetBranchId) throw new ApiError(400, 'branchId is required');

  const lead = await Lead.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const targetBranch = await Branch.findById(targetBranchId).select('name status');
  if (!targetBranch || targetBranch.status !== 'active') {
    throw new ApiError(404, 'Target branch not found or inactive');
  }
  if (String(lead.branchId || '') === String(targetBranch._id)) {
    throw new ApiError(400, 'Lead is already in selected branch');
  }

  const fromBranchId = lead.branchId;
  lead.branchId = targetBranch._id;
  lead.assignedTo = null;
  lead.assignedManager = null;
  lead.assignedTeamLeader = null;
  lead.assigneeRole = null;
  await lead.save();

  await logLeadActivity({
    leadId: lead._id,
    branchId: targetBranch._id,
    type: 'lead_transferred',
    description: `Transferred to branch ${targetBranch.name}`,
    actor: req.user,
    meta: { fromBranchId, toBranchId: targetBranch._id },
  });
  await logLeadTransfer({
    leadId: lead._id,
    branchId: targetBranch._id,
    type: 'branch_transfer',
    actor: req.user,
    fromBranchId,
    toBranchId: targetBranch._id,
    note: `Transferred to ${targetBranch.name}`,
  });

  await logActivity({
    type: 'lead_branch_transferred',
    user: req.user.name,
    userId: req.user._id,
    action: `Transferred lead ${lead.leadId || lead.name} to branch ${targetBranch.name}`,
    target: lead.name,
    ip: getClientIp(req),
    branchId: targetBranch._id,
    meta: { leadId: lead._id, targetBranchId: targetBranch._id },
  });

  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  res.json(enrichLead(populated));
});

const addLeadNote = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) throw new ApiError(400, 'Note text is required');

  const lead = await findAccessibleLeadDoc(req, req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  const note = await LeadNote.create({
    lead: lead._id,
    text: text.trim(),
    user: req.user._id,
  });

  const stamp = new Date().toISOString();
  lead.notes = `${lead.notes || ''}\n[${stamp}] ${text.trim()}`.trim();
  await lead.save();

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'note_added',
    description: text.trim().slice(0, 500),
    actor: req.user,
    meta: { noteId: note._id },
  }).catch(() => {});

  const populated = await LeadNote.findById(note._id).populate('user', 'name email').lean();

  parseAndNotifyMentions(text, req.user, `lead ${lead.name}`, {
    leadId: lead._id,
    branchId: lead.branchId || req.branchId || null,
    mentionIds: req.body.mentions,
  }).catch(() => {});

  res.status(201).json({
    date: stamp,
    text: text.trim(),
    user: populated.user?.name || req.user.name,
    _id: populated._id,
  });
});

module.exports = {
  listLeads,
  listLostLeads,
  getListKpis,
  getLead,
  getLeadFollowups,
  getLeadQuotations,
  getLeadNotesList,
  getLeadPaymentReceiptDoc,
  sendLeadPaymentReceipt,
  createLead,
  seedDemoLeads,
  clearAllLeads,
  updateLead,
  deleteLead,
  getAssignees,
  assignLeads,
  transferLeadBranch,
  addLeadNote,
  reactivateLead,
  reassignReactivatedLead,
  updateReactivationStage,
};
