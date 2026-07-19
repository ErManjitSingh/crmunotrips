const Lead = require('../models/Lead');
const LeadNote = require('../models/LeadNote');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { LEAD_STATUSES } = require('../models/Lead');
const { buildExecutiveDashboard } = require('../services/dashboardService');
const { getTeamLeaderForExecutive } = require('../services/teamScopeService');
const { logActivity, getClientIp } = require('../services/activityService');
const { logLeadActivity } = require('../services/leadActivityService');
const { onLeadConverted, isLeadStatusLocked } = require('../services/leadConversionService');
const {
  getLeadPaymentSummary,
  getLeadPaymentReceipt,
  sendReceiptToCustomer,
  generateAndStoreReceipt,
} = require('../services/paymentReceiptService');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { invalidate: invalidateDashboardCache } = require('../services/dashboardCacheService');
const { notifyQuotationCreated } = require('../services/notificationService');
const {
  loadLeadCore,
  loadLeadRelated,
  loadLeadQuotations,
  loadLeadNotes,
} = require('../services/leadDetailService');
const {
  LEAD_POPULATE,
  FOLLOWUP_POPULATE,
  QUOTATION_POPULATE,
  enrichLead,
  buildLeadSearchFilter,
  buildFollowUpTabFilter,
  buildFollowUpCategoryFilter,
  formatNotification,
  generateQuoteNumber,
} = require('../utils/queryHelpers');
const { createFollowUpForLead, updateFollowUpRecord } = require('../services/followUpService');
const { markLeadViewedByExecutive } = require('../services/leadExecutiveStallService');
const {
  getExecutiveLeadIds,
  buildExecutiveFollowUpFilter,
  buildExecutiveQuotationFilter,
} = require('../services/executiveScopeService');
const { resolvePackageReference } = require('../utils/packageRef');
const { getExecutiveFollowUpSummary, getMissedFollowUpsPreview } = require('../services/followUpSummaryService');
const { normalizeLeadInput } = require('../utils/normalizeLeadInput');
const { ROLE_LABELS } = require('../config/roles');
const { getOrSetFresh, cacheKey } = require('../services/dashboardCacheService');
const {
  findExecutiveLeadsPaginated,
  findScopedFollowUpsPaginated,
  findScopedQuotationsPaginated,
} = require('../repositories/roleScopedRepository');

const LEAD_FILTER_KEYS = ['new', 'contacted', 'follow-up', 'hot', 'converted', 'lost', 'reactivated', 'all'];

async function resolveExecutiveQuotationStatus(leadId, requestedStatus, excludeQuotationId = null) {
  if (requestedStatus === 'draft') return 'draft';

  const filter = {
    lead: leadId,
    status: { $ne: 'draft' },
    ...(excludeQuotationId ? { _id: { $ne: excludeQuotationId } } : {}),
  };
  const priorCount = await Quotation.countDocuments(filter);
  return priorCount === 0 ? 'approved' : 'pending_approval';
}

function buildExecutiveLeadFilter(filter) {
  if (filter === 'new') return { status: 'new' };
  if (filter === 'contacted') return { status: 'contacted' };
  if (filter === 'follow-up') return { status: { $in: ['follow_up', 'negotiation'] } };
  if (filter === 'converted') return { status: 'converted' };
  if (filter === 'lost') return { status: { $in: ['lost', 'booked_from_another_company'] } };
  return {};
}

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await getOrSetFresh(
    req,
    cacheKey('sales_executive', `${req.user._id}:${req.branchId || 'all'}`),
    () => buildExecutiveDashboard(req.user._id, { branchId: req.branchId }),
    60 * 1000
  );
  res.json(stats);
});

const listLeads = asyncHandler(async (req, res) => {
  const filterKey = req.query.filter || req.params.filter;
  const result = await findExecutiveLeadsPaginated(
    req.user._id,
    {
      ...req.query,
      filter: filterKey,
    },
    { branchId: req.branchId }
  );
  res.json(result);
});

const getLeadDetail = asyncHandler(async (req, res) => {
  const lead = await loadLeadCore(req.params.id, {
    branchId: req.branchId,
    extraFilter: { assignedTo: req.user._id },
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  markLeadViewedByExecutive(lead._id, req.user._id).catch(() => {});

  const paymentSummary = await getLeadPaymentSummary(lead._id);

  const includeRelated = req.query.includeRelated === '1' || req.query.includeRelated === 'true';
  if (!includeRelated) {
    res.json({ ...enrichLead(lead), paymentSummary });
    return;
  }

  const related = await loadLeadRelated(lead._id, { branchId: req.branchId });
  res.json({ ...enrichLead(lead), ...related, paymentSummary });
});

const getLeadPaymentReceiptDoc = asyncHandler(async (req, res) => {
  const data = await getLeadPaymentReceipt(req.params.id, {
    branchId: req.branchId,
    extraFilter: { assignedTo: req.user._id },
  });
  res.json(data);
});

const sendLeadPaymentReceipt = asyncHandler(async (req, res) => {
  const lead = await loadLeadCore(req.params.id, {
    branchId: req.branchId,
    extraFilter: { assignedTo: req.user._id },
  });
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

const getLeadQuotationsList = asyncHandler(async (req, res) => {
  const lead = await loadLeadCore(req.params.id, {
    branchId: req.branchId,
    extraFilter: { assignedTo: req.user._id },
  });
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadQuotations(lead._id, { branchId: req.branchId, query: req.query });
  res.json(result);
});

const getLeadNotesList = asyncHandler(async (req, res) => {
  const lead = await loadLeadCore(req.params.id, {
    branchId: req.branchId,
    extraFilter: { assignedTo: req.user._id },
  });
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadNotes(lead._id, { query: req.query });
  res.json(result);
});

/** Executives can change status OR edit lead details (name/phone/email stay locked). */
const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.params.id,
    assignedTo: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const { status, statusReason, advanceAmount, tokenAmount, paymentMethod, sendReceipt } = req.body;
  const statusOnlyKeys = new Set([
    'status',
    'statusReason',
    'advanceAmount',
    'tokenAmount',
    'paymentMethod',
    'sendReceipt',
  ]);
  const otherFields = Object.keys(req.body).filter((k) => !statusOnlyKeys.has(k));
  const isStatusOnlyUpdate = Boolean(status) && otherFields.length === 0;

  if (isStatusOnlyUpdate) {
    if (!LEAD_STATUSES.includes(status)) throw new ApiError(400, 'Invalid lead status');
    const trimmedReason = typeof statusReason === 'string' ? statusReason.trim() : '';
    if (['lost', 'booked_from_another_company'].includes(status) && !trimmedReason) {
      throw new ApiError(400, 'Reason is required for this status');
    }
    if (status === 'converted') {
      const advance = Number(advanceAmount ?? tokenAmount);
      if (!Number.isFinite(advance) || advance < 0) {
        throw new ApiError(400, 'Enter advance / token amount received (₹)');
      }
    }
    if (isLeadStatusLocked(lead.status)) {
      throw new ApiError(400, 'Lead status cannot be changed after conversion or closure');
    }

    const prevStatus = lead.status;
    lead.status = status;
    lead.statusReason = trimmedReason;
    lead.statusReasonUpdatedAt = new Date();
    await lead.save();

    if (status !== prevStatus) {
      const typeMap = {
        lost: 'lead_lost',
        booked_from_another_company: 'lead_lost',
        converted: 'lead_converted',
        quotation_sent: 'quotation_sent',
        reactivated: 'lead_reactivated',
      };
      const statusLabel = status.replace(/_/g, ' ');
      await logLeadActivity({
        leadId: lead._id,
        branchId: lead.branchId,
        type: typeMap[status] || 'status_changed',
        description: `Status changed from ${prevStatus.replace(/_/g, ' ')} to ${statusLabel}${trimmedReason ? ` — ${trimmedReason}` : ''}`,
        actor: req.user,
        meta: {
          from: prevStatus,
          to: status,
          reason: trimmedReason || undefined,
          advanceAmount: status === 'converted' ? Number(advanceAmount ?? tokenAmount) : undefined,
        },
      });
    }

    if (status === 'converted' && prevStatus !== 'converted') {
      await onLeadConverted(lead, req.user, {
        advanceAmount: Number(advanceAmount ?? tokenAmount),
        paymentMethod,
        sendReceipt: sendReceipt !== false,
      }).catch((err) => {
        console.error('[LeadConversion]', err.message);
      });
    } else if (status !== prevStatus) {
      invalidateDashboardCache('sales_executive');
      invalidateDashboardCache('sales_manager');
      invalidateDashboardCache('team_leader');
      invalidateDashboardCache('admin');
      invalidateDashboardCache('nav:');
    }

    const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
    const paymentSummary = await getLeadPaymentSummary(lead._id);
    res.json({ ...enrichLead(populated), paymentSummary });
    return;
  }

  const data = normalizeLeadInput(req.body, { isUpdate: true });

  // Identity locks for sales executive
  delete data.name;
  delete data.phone;
  delete data.email;
  delete data.status;
  delete data.assignedTo;
  delete data.branchId;

  const lockedAttempt =
    (req.body.name != null && String(req.body.name).trim() !== String(lead.name || '').trim()) ||
    (req.body.phone != null && String(req.body.phone).trim() !== String(lead.phone || '').trim()) ||
    (req.body.email != null && String(req.body.email || '').trim() !== String(lead.email || '').trim());
  if (lockedAttempt) {
    throw new ApiError(403, 'Name, phone and email cannot be changed. You can add another phone or email.');
  }

  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) lead[key] = data[key];
  });

  await lead.save();
  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_edited',
    description: 'Lead details updated by sales executive',
    actor: req.user,
    meta: {
      alternatePhone: lead.alternatePhone || undefined,
      alternateEmail: lead.alternateEmail || undefined,
    },
  });

  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  const paymentSummary = await getLeadPaymentSummary(lead._id);
  res.json({ ...enrichLead(populated), paymentSummary });
});

const addLeadNote = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) throw new ApiError(400, 'Note text is required');

  const lead = await Lead.findOne({
    _id: req.params.id,
    assignedTo: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const note = await LeadNote.create({
    lead: lead._id,
    text: text.trim(),
    user: req.user._id,
  });

  const stamp = new Date().toISOString();
  lead.notes = `${lead.notes || ''}\n[${stamp}] ${text.trim()}`.trim();
  await lead.save();

  res.status(201).json({
    date: stamp,
    text: text.trim(),
    user: req.user.name,
    _id: note._id,
  });
});

const listFollowUps = asyncHandler(async (req, res) => {
  const leadIds = await getExecutiveLeadIds(req.user._id, req.branchId);
  const result = await findScopedFollowUpsPaginated(
    buildExecutiveFollowUpFilter(req.user._id, req.branchId, leadIds),
    req.query,
    { branchId: req.branchId }
  );
  res.json(result);
});

const getFollowUpSummary = asyncHandler(async (req, res) => {
  const leadIds = await getExecutiveLeadIds(req.user._id, req.branchId);
  const baseFilter = buildExecutiveFollowUpFilter(req.user._id, req.branchId, leadIds);
  const [summary, missedPreview] = await Promise.all([
    getExecutiveFollowUpSummary(req.user._id, leadIds),
    getMissedFollowUpsPreview(baseFilter, 8),
  ]);
  res.json({ ...summary, missedPreview });
});

const createFollowUp = asyncHandler(async (req, res) => {
  const leadId = req.body.lead || req.body.leadId;
  const lead = await Lead.findOne({ _id: leadId, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!lead) throw new ApiError(404, 'Lead not found');

  if (lead.assignedTo?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'This lead is not assigned to you');
  }

  const populated = await createFollowUpForLead({ body: req.body, user: req.user });
  res.status(201).json(populated);
});

const updateFollowUp = asyncHandler(async (req, res) => {
  const leadIds = await getExecutiveLeadIds(req.user._id, req.branchId);
  const followup = await FollowUp.findOne({
    _id: req.params.id,
    ...buildExecutiveFollowUpFilter(req.user._id, req.branchId, leadIds),
  });
  if (!followup) throw new ApiError(404, 'Follow-up not found');

  const populated = await updateFollowUpRecord({ followup, body: req.body, user: req.user });
  res.json(populated);
});

const listQuotations = asyncHandler(async (req, res) => {
  const leadIds = await getExecutiveLeadIds(req.user._id, req.branchId);
  const filter = buildExecutiveQuotationFilter(req.user._id, req.branchId, leadIds);
  if (req.query.status) filter.status = req.query.status;

  const result = await findScopedQuotationsPaginated(filter, req.query, { branchId: req.branchId });
  res.json(result);
});

const createQuotation = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.body.leadId,
    assignedTo: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(403, 'Lead not assigned to you');

  const teamLeader = await getTeamLeaderForExecutive(req.user._id);
  const requestedStatus = req.body.status === 'draft' ? 'draft' : 'pending_approval';
  const status = await resolveExecutiveQuotationStatus(lead._id, requestedStatus);
  const now = new Date();

  const timeline = [
    {
      type: 'created',
      date: now,
      user: req.user.name,
      notes: 'Quote created by sales executive',
    },
  ];

  if (status === 'approved') {
    timeline.push({
      type: 'approved',
      date: now,
      user: req.user.name,
      notes: 'First quotation — auto-approved',
    });
  } else if (status === 'pending_approval' && teamLeader) {
    timeline.push({
      type: 'pending_approval',
      date: now,
      user: req.user.name,
      notes: `Submitted to ${teamLeader.name} (Team Leader) for approval`,
    });
  }

  const quotation = await Quotation.create({
    quoteNumber: req.body.quoteNumber || generateQuoteNumber(),
    lead: lead._id,
    package: resolvePackageReference(req.body.packageId),
    packageSnapshot: req.body.package,
    status,
    pricing: req.body.pricing,
    selectedHotels: req.body.selectedHotels || [],
    selectedCabs: req.body.selectedCabs || [],
    selectedFlights: req.body.selectedFlights || [],
    customizations: req.body.customizations,
    createdByExecutive: req.user._id,
    branchId: req.branchId || req.user.branchId || null,
    teamLeader: teamLeader?._id,
    timeline,
    createdBy: req.user._id,
  });

  if ((status === 'pending_approval' || status === 'approved') && lead.status === 'new') {
    lead.status = 'quotation_sent';
    await lead.save();
  }

  await logActivity({
    type: 'quotation_created',
    user: req.user.name,
    userId: req.user._id,
    action:
      status === 'pending_approval'
        ? 'Submitted quote for approval'
        : status === 'approved'
          ? 'Created and auto-approved first quotation'
          : 'Saved quote draft',
    target: quotation.quoteNumber,
    ip: getClientIp(req),
    branchId: req.branchId || lead.branchId || req.user.branchId || null,
  });

  const quoteTotal =
    Number(quotation.pricing?.total) ||
    Number(quotation.costing?.grandTotal) ||
    Number(req.body.pricing?.total) ||
    0;
  const pkgName = req.body.package?.name || lead.destination || 'Package';
  const priceLabel = `₹${Number(quoteTotal).toLocaleString('en-IN')}`;
  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'quotation_created',
    description: `${quotation.quoteNumber} · ${pkgName} · ${priceLabel} · ${status.replace(/_/g, ' ')}`,
    actor: req.user,
    meta: {
      quotationId: quotation._id,
      quoteNumber: quotation.quoteNumber,
      status,
      amount: quoteTotal,
    },
  });

  if (status === 'pending_approval') {
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'quotation_submitted',
      title: 'Quotation Submitted',
      description: `${quotation.quoteNumber} submitted for Team Leader approval · ${pkgName} · ${priceLabel}`,
      actor: req.user,
      meta: {
        quotationId: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status,
        amount: quoteTotal,
      },
    });
  } else if (status === 'approved') {
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'quotation_approved',
      description: `${quotation.quoteNumber} auto-approved · ${pkgName} · ${priceLabel}`,
      actor: req.user,
      meta: {
        quotationId: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status,
        amount: quoteTotal,
      },
    });
  } else if (status === 'sent') {
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'quotation_sent',
      description: `${quotation.quoteNumber} sent to customer · ${pkgName} · ${priceLabel}`,
      actor: req.user,
      meta: {
        quotationId: quotation._id,
        quoteNumber: quotation.quoteNumber,
        amount: quoteTotal,
      },
    });
  }

  const populated = await Quotation.findById(quotation._id).populate(QUOTATION_POPULATE).lean();
  if (status === 'pending_approval') {
    notifyQuotationCreated(populated, lead, { approverIds: teamLeader ? [teamLeader._id] : [] }).catch(() => {});
  }
  res.status(201).json(populated);
});

const updateQuotation = asyncHandler(async (req, res) => {
  const leadIds = await getExecutiveLeadIds(req.user._id, req.branchId);
  const quotation = await Quotation.findOne({
    _id: req.params.id,
    ...buildExecutiveQuotationFilter(req.user._id, req.branchId, leadIds),
  });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  const { action, data, remarks } = req.body;
  const now = new Date();

  if (action === 'send') {
    if (quotation.status === 'pending_approval') {
      throw new ApiError(400, 'Awaiting Team Leader approval before sending to customer');
    }
    if (quotation.status !== 'approved') {
      throw new ApiError(400, 'Quotation must be approved by Team Leader before sending');
    }
    quotation.status = 'sent';
    quotation.sentAt = now;
    quotation.timeline.push({
      type: 'sent',
      date: now,
      user: req.user.name,
      notes: remarks || 'Sent to customer',
    });
  } else if (action === 'submit') {
    const teamLeader = quotation.teamLeader || (await getTeamLeaderForExecutive(req.user._id));
    const status = await resolveExecutiveQuotationStatus(quotation.lead, 'pending_approval', quotation._id);
    quotation.status = status;
    if (status === 'approved') {
      quotation.timeline.push({
        type: 'approved',
        date: now,
        user: req.user.name,
        notes: 'First quotation — auto-approved',
      });
    } else {
      quotation.timeline.push({
        type: 'pending_approval',
        date: now,
        user: req.user.name,
        notes: teamLeader
          ? `Submitted to ${teamLeader.name || 'Team Leader'} for approval`
          : 'Submitted for approval',
      });
    }
  } else if (action === 'edit') {
    Object.assign(quotation, data || {});
    quotation.status = 'draft';
  } else {
    Object.assign(quotation, req.body);
  }

  await quotation.save();
  const populated = await Quotation.findById(quotation._id).populate(QUOTATION_POPULATE).lean();
  res.json(populated);
});

const listCustomers = asyncHandler(async (req, res) => {
  const leads = await Lead.find({
    assignedTo: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    $or: [{ status: 'converted' }, { isRepeatCustomer: true }],
  })
    .select('name email phone destination budget isRepeatCustomer')
    .lean();

  res.json(
    leads.map((l) => ({
      _id: l._id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      destination: l.destination,
      trips: l.isRepeatCustomer ? 2 : 1,
      totalSpent: l.budget,
    }))
  );
});

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({
    user: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  res.json(notifications.map(formatNotification));
});

const getProfile = asyncHandler(async (req, res) => {
  const dashboard = await getOrSetFresh(
    req,
    cacheKey('sales_executive', `${req.user._id}:${req.branchId || 'all'}`),
    () => buildExecutiveDashboard(req.user._id, { branchId: req.branchId }),
    60 * 1000
  );
  const activity = await ActivityLog.find({
    userId: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      roleName: ROLE_LABELS[req.user.role] || req.user.role,
      department: req.user.department || 'Sales',
    },
    metrics: dashboard.target,
    activity,
  });
});

const getCalendar = asyncHandler(async (req, res) => {
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 30);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 120);

  const [followups, travelLeads] = await Promise.all([
    FollowUp.find({
      assignedTo: req.user._id,
      scheduledAt: { $gte: rangeStart, $lte: rangeEnd },
      ...(req.branchId ? { branchId: req.branchId } : {}),
    })
      .populate('lead', 'name')
      .sort({ scheduledAt: 1 })
      .limit(200)
      .lean(),
    Lead.find({
      assignedTo: req.user._id,
      travelDate: { $gte: rangeStart, $lte: rangeEnd },
      ...(req.branchId ? { branchId: req.branchId } : {}),
    })
      .select('name destination travelDate')
      .sort({ travelDate: 1 })
      .limit(100)
      .lean(),
  ]);

  const fuEvents = followups.map((f) => ({
    _id: f._id,
    title: `Follow-up: ${f.lead?.name}`,
    start: f.scheduledAt,
    type: 'followup',
  }));

  const travelEvents = travelLeads.map((l) => ({
    _id: `travel-${l._id}`,
    title: `Travel: ${l.name} → ${l.destination}`,
    start: l.travelDate,
    type: 'travel',
  }));

  res.json([...fuEvents, ...travelEvents]);
});

module.exports = {
  LEAD_FILTER_KEYS,
  getDashboard,
  listLeads,
  getLeadDetail,
  getLeadQuotationsList,
  getLeadNotesList,
  getLeadPaymentReceiptDoc,
  sendLeadPaymentReceipt,
  updateLead,
  addLeadNote,
  listFollowUps,
  getFollowUpSummary,
  createFollowUp,
  updateFollowUp,
  listQuotations,
  createQuotation,
  updateQuotation,
  listCustomers,
  listNotifications,
  getProfile,
  getCalendar,
};
