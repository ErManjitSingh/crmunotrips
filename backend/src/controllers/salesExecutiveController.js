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

function normalizeResubmissionReason(raw) {
  return String(raw || '').trim().slice(0, 1000);
}

function assertResubmissionReasonIfNeeded(status, reason) {
  if (status !== 'pending_approval') return '';
  const cleaned = normalizeResubmissionReason(reason);
  if (!cleaned) {
    throw new ApiError(
      400,
      'Please provide a reason for submitting this quotation again for approval'
    );
  }
  return cleaned;
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
  const destinationPeriod = req.query.destinationPeriod || 'all';
  const cacheSuffix = `${req.user._id}:${req.branchId || 'all'}:${destinationPeriod}`;
  const stats = await getOrSetFresh(
    req,
    cacheKey('sales_executive', cacheSuffix),
    () => buildExecutiveDashboard(req.user._id, {
      branchId: req.branchId,
      destinationPeriod,
    }),
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

  const {
    status,
    statusReason,
    advanceAmount,
    tokenAmount,
    paymentMethod,
    sendReceipt,
    paymentScreenshotBase64,
    paymentScreenshotName,
  } = req.body;
  const statusOnlyKeys = new Set([
    'status',
    'statusReason',
    'advanceAmount',
    'tokenAmount',
    'paymentMethod',
    'sendReceipt',
    'paymentScreenshotBase64',
    'paymentScreenshotName',
  ]);
  const otherFields = Object.keys(req.body).filter((k) => !statusOnlyKeys.has(k));
  const isStatusOnlyUpdate = Boolean(status) && otherFields.length === 0;
  const isColdCallDoneOnly =
    (req.body.coldCallDone === true || req.body.coldCallDone === 'true') &&
    otherFields.every((k) => ['coldCallDone', 'coldCallNotes'].includes(k));

  if (isColdCallDoneOnly) {
    const { markColdCallDone } = require('../services/coldLeadService');
    await markColdCallDone(lead, {
      user: req.user,
      notes: req.body.coldCallNotes || 'Cold call done',
    });
    invalidateDashboardCache('sales_executive');
    const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
    const paymentSummary = await getLeadPaymentSummary(lead._id);
    res.json({ ...enrichLead(populated), paymentSummary });
    return;
  }

  if (isStatusOnlyUpdate) {
    if (!LEAD_STATUSES.includes(status)) throw new ApiError(400, 'Invalid lead status');
    const trimmedReason = typeof statusReason === 'string' ? statusReason.trim() : '';
    if (status === 'converted') {
      const advance = Number(advanceAmount ?? tokenAmount);
      if (!Number.isFinite(advance) || advance < 0) {
        throw new ApiError(400, 'Enter advance / token amount received (₹)');
      }
      if (!paymentScreenshotBase64) {
        throw new ApiError(400, 'Upload payment screenshot (UPI / bank transfer proof)');
      }
    }
    if (isLeadStatusLocked(lead.status)) {
      throw new ApiError(400, 'Lead status cannot be changed after conversion or closure');
    }

    const prevStatus = lead.status;
    lead.status = status;

    if (['lost', 'booked_from_another_company'].includes(status)) {
      const { assertValidLostReason, lostReasonLabel } = require('../services/salesSopService');
      const reasonValue =
        status === 'booked_from_another_company' && !trimmedReason
          ? 'booked_elsewhere'
          : assertValidLostReason(trimmedReason || (status === 'booked_from_another_company' ? 'booked_elsewhere' : ''));
      lead.statusReason = reasonValue;
      req._lostReasonLabel = lostReasonLabel(reasonValue);
    } else {
      lead.statusReason = trimmedReason;
    }
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
      const reasonText = req._lostReasonLabel || trimmedReason;
      await logLeadActivity({
        leadId: lead._id,
        branchId: lead.branchId,
        type: typeMap[status] || 'status_changed',
        description: `Status changed from ${prevStatus.replace(/_/g, ' ')} to ${statusLabel}${reasonText ? ` — ${reasonText}` : ''}`,
        actor: req.user,
        meta: {
          from: prevStatus,
          to: status,
          reason: lead.statusReason || undefined,
          advanceAmount: status === 'converted' ? Number(advanceAmount ?? tokenAmount) : undefined,
        },
      });
    }

    if (status === 'converted' && prevStatus !== 'converted') {
      await onLeadConverted(lead, req.user, {
        advanceAmount: Number(advanceAmount ?? tokenAmount),
        paymentMethod,
        sendReceipt: sendReceipt !== false,
        paymentScreenshotBase64,
        paymentScreenshotName,
      }).catch((err) => {
        console.error('[LeadConversion]', err.message);
      });
    } else if (status !== prevStatus) {
      invalidateDashboardCache('sales_executive');
      invalidateDashboardCache('sales_manager');
      invalidateDashboardCache('team_leader');
      invalidateDashboardCache('admin');
      invalidateDashboardCache('nav:');
      invalidateDashboardCache('lead-list-kpis');
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

  const coldCallDone = req.body.coldCallDone === true || req.body.coldCallDone === 'true';
  const markedCold =
    data.temperature === 'cold' ||
    req.body.temperature === 'cold' ||
    Boolean(req.body.coldReason && String(req.body.coldReason).trim());

  if (coldCallDone) {
    const { markColdCallDone } = require('../services/coldLeadService');
    await markColdCallDone(lead, {
      user: req.user,
      notes: req.body.coldCallNotes || 'Cold call done',
    });
  } else if (markedCold) {
    const { scheduleColdLeadReminder } = require('../services/coldLeadService');
    await scheduleColdLeadReminder(lead, {
      reason: req.body.coldReason || data.coldReason || lead.coldReason,
      user: req.user,
      notes: req.body.coldCallNotes || '',
    });
  } else {
    await lead.save();
  }

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

const getQuotation = asyncHandler(async (req, res) => {
  const leadIds = await getExecutiveLeadIds(req.user._id, req.branchId);
  const quotation = await Quotation.findOne({
    _id: req.params.id,
    ...buildExecutiveQuotationFilter(req.user._id, req.branchId, leadIds),
  })
    .populate(QUOTATION_POPULATE)
    .lean();
  if (!quotation) throw new ApiError(404, 'Quotation not found');
  res.json(quotation);
});

const createQuotation = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.body.leadId,
    assignedTo: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(403, 'Lead not assigned to you');

  const { assertQualifiedForQuotation } = require('../services/salesSopService');
  if (req.body.status !== 'draft') {
    assertQualifiedForQuotation(lead);
  }
  const teamLeader = await getTeamLeaderForExecutive(req.user._id);
  const requestedStatus = req.body.status === 'draft' ? 'draft' : 'pending_approval';
  const status = await resolveExecutiveQuotationStatus(lead._id, requestedStatus);
  const resubmissionReason = assertResubmissionReasonIfNeeded(
    status,
    req.body.resubmissionReason || req.body.submissionReason
  );
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
      notes: `Submitted to ${teamLeader.name} (Team Leader) for approval. Reason: ${resubmissionReason}`,
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
    selectedActivities: req.body.selectedActivities || [],
    customizations: req.body.customizations,
    resubmissionReason: resubmissionReason || '',
    createdByExecutive: req.user._id,
    branchId: req.branchId || req.user.branchId || null,
    teamLeader: teamLeader?._id,
    timeline,
    createdBy: req.user._id,
  });

  const {
    snapshotCosting1,
    buildCosting2,
    applyCosting2ToQuotation,
    buildQuotePackageSummary,
  } = require('../services/quotationApprovalCostingService');
  quotation.costing1 = snapshotCosting1(quotation);
  quotation.packageSummary = buildQuotePackageSummary({
    ...quotation.toObject(),
    lead,
    package: req.body.package,
  });
  if (status === 'approved') {
    const c2 = buildCosting2({
      quotation,
      markupPercent: quotation.costing1.markupPercent,
      actor: req.user,
    });
    applyCosting2ToQuotation(quotation, c2);
    quotation.approvedBy = req.user._id;
    quotation.approvedAt = now;
  }
  await quotation.save();

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
      description: `${quotation.quoteNumber} submitted for Team Leader approval · ${pkgName} · ${priceLabel}${
        resubmissionReason ? ` · Reason: ${resubmissionReason}` : ''
      }`,
      actor: req.user,
      meta: {
        quotationId: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status,
        amount: quoteTotal,
        resubmissionReason: resubmissionReason || null,
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
    const resubmissionReason = assertResubmissionReasonIfNeeded(
      status,
      req.body.resubmissionReason || req.body.submissionReason || remarks
    );
    quotation.status = status;
    if (resubmissionReason) quotation.resubmissionReason = resubmissionReason;
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
          ? `Submitted to ${teamLeader.name || 'Team Leader'} for approval. Reason: ${resubmissionReason}`
          : `Submitted for approval. Reason: ${resubmissionReason}`,
      });
    }
  } else if (action === 'edit') {
    const payload = data && typeof data === 'object' ? data : req.body;
    const prevStatus = quotation.status;

    if (payload.packageId !== undefined) {
      quotation.package = resolvePackageReference(payload.packageId);
    }
    if (payload.package !== undefined) quotation.packageSnapshot = payload.package;
    if (payload.pricing !== undefined) quotation.pricing = payload.pricing;
    if (payload.selectedHotels !== undefined) quotation.selectedHotels = payload.selectedHotels || [];
    if (payload.selectedCabs !== undefined) quotation.selectedCabs = payload.selectedCabs || [];
    if (payload.selectedFlights !== undefined) quotation.selectedFlights = payload.selectedFlights || [];
    if (payload.selectedActivities !== undefined) {
      quotation.selectedActivities = payload.selectedActivities || [];
    }
    if (payload.customizations !== undefined) quotation.customizations = payload.customizations;

    const {
      snapshotCosting1,
      buildQuotePackageSummary,
    } = require('../services/quotationApprovalCostingService');
    quotation.costing1 = snapshotCosting1(quotation);
    quotation.packageSummary = buildQuotePackageSummary(quotation);

    const wantSubmit = payload.status && payload.status !== 'draft';
    if (wantSubmit) {
      const { assertQualifiedForQuotation } = require('../services/salesSopService');
      const leadDoc = await Lead.findById(quotation.lead);
      if (leadDoc) assertQualifiedForQuotation(leadDoc);
      const nextStatus = await resolveExecutiveQuotationStatus(
        quotation.lead,
        'pending_approval',
        quotation._id
      );
      const resubmissionReason = assertResubmissionReasonIfNeeded(
        nextStatus,
        payload.resubmissionReason || payload.submissionReason || remarks
      );
      quotation.status = nextStatus;
      if (resubmissionReason) quotation.resubmissionReason = resubmissionReason;
      quotation.timeline.push({
        type: nextStatus === 'approved' ? 'approved' : 'pending_approval',
        date: now,
        user: req.user.name,
        notes:
          nextStatus === 'approved'
            ? 'Updated quotation — auto-approved'
            : `Updated and re-submitted for approval (was ${prevStatus}). Reason: ${resubmissionReason}`,
      });
    } else {
      quotation.status = 'draft';
      quotation.timeline.push({
        type: 'updated',
        date: now,
        user: req.user.name,
        notes: remarks || `Quotation edited (was ${prevStatus}) — saved as draft`,
      });
    }
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

const acceptLead = asyncHandler(async (req, res) => {
  const { acceptAssignedLead } = require('../services/leadAcceptanceService');
  const lead = await acceptAssignedLead({
    leadId: req.params.id,
    executiveId: req.user._id,
    branchId: req.branchId,
  });
  invalidateDashboardCache('sales_executive');
  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  res.json(enrichLead(populated));
});

const getCommercialForm = asyncHandler(async (req, res) => {
  const { getCommercialFormDraft } = require('../services/conversionCommercialService');
  const draft = await getCommercialFormDraft({
    leadId: req.params.id,
    executiveId: req.user._id,
    branchId: req.branchId,
  });
  res.json(draft);
});

const saveCommercialForm = asyncHandler(async (req, res) => {
  const { saveCommercialForm: saveForm } = require('../services/conversionCommercialService');
  const saved = await saveForm({
    leadId: req.params.id,
    executiveId: req.user._id,
    branchId: req.branchId,
    body: req.body,
  });
  res.json(saved);
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
  acceptLead,
  getCommercialForm,
  saveCommercialForm,
  addLeadNote,
  listFollowUps,
  getFollowUpSummary,
  createFollowUp,
  updateFollowUp,
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  listCustomers,
  listNotifications,
  getProfile,
  getCalendar,
};
