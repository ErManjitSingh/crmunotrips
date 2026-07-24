const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  getExecutiveIdsForLeader,
  getTeamForLeader,
  getLeaderLeadScopeFilter,
} = require('../services/teamScopeService');
const { getMonthlyTarget, buildTargetProgress } = require('../services/salesTargetService');
const { buildTeamLeaderDashboard } = require('../services/dashboardService');
const { sumConvertedPackageRevenue } = require('../utils/convertedPackageRevenue');
const { stampExecutiveAssignment } = require('../services/leadExecutiveStallService');
const { getOrSetFresh, cacheKey } = require('../services/dashboardCacheService');
const {
  findTeamLeaderLeadsPaginated,
  findScopedFollowUpsPaginated,
  findScopedQuotationsPaginated,
} = require('../repositories/roleScopedRepository');
const { persistQuotation } = require('../services/quotationCreateService');
const { logActivity, getClientIp } = require('../services/activityService');
const {
  notifyLeadAssigned,
  notifyQuotationApproved,
  notifyQuotationRejected,
} = require('../services/notificationService');
const {
  loadLeadCore,
  loadLeadRelated,
  loadLeadQuotations,
  loadLeadNotes,
} = require('../services/leadDetailService');
const {
  LEAD_POPULATE,
  LEAD_LIST_POPULATE,
  FOLLOWUP_POPULATE,
  QUOTATION_POPULATE,
  enrichLead,
  buildLeadSearchFilter,
  buildFollowUpTabFilter,
  buildFollowUpCategoryFilter,
  generateQuoteNumber,
  formatNotification,
} = require('../utils/queryHelpers');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const getMyTeam = asyncHandler(async (req, res) => {
  const team = await getTeamForLeader(req.user._id);
  if (!team) {
    return res.json({
      team: null,
      members: [],
      message: 'No team is linked to your account. Ask your Sales Manager to create a team and add executives.',
    });
  }

  const members = (team.members || [])
    .filter((m) => m.role === 'sales_executive')
    .map((m) => ({
      _id: m._id,
      name: m.name,
      email: m.email,
      role: m.role,
      status: m.status,
    }));

  res.json({
    team: { _id: team._id, name: team.name, description: team.description || '' },
    members,
    memberCount: members.length,
    message: members.length ? null : 'Your team has no sales executives yet. Ask Sales Manager to add members.',
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await getOrSetFresh(
    req,
    cacheKey('team_leader', `${req.user._id}:${req.branchId || 'all'}`),
    () => buildTeamLeaderDashboard(req.user._id, { branchId: req.branchId }),
    60 * 1000
  );
  res.json(stats);
});

const listLeads = asyncHandler(async (req, res) => {
  const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
  const result = await findTeamLeaderLeadsPaginated(squadFilter, req.query, { branchId: req.branchId });
  res.json(result);
});

const getLeadDetail = asyncHandler(async (req, res) => {
  const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
  const lead = await loadLeadCore(req.params.id, {
    branchId: req.branchId,
    extraFilter: squadFilter,
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const includeRelated = req.query.includeRelated === '1' || req.query.includeRelated === 'true';
  if (!includeRelated) {
    res.json(enrichLead(lead));
    return;
  }

  const related = await loadLeadRelated(lead._id, { branchId: req.branchId });
  res.json({ ...enrichLead(lead), ...related });
});

const getLeadQuotationsList = asyncHandler(async (req, res) => {
  const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
  const lead = await loadLeadCore(req.params.id, { branchId: req.branchId, extraFilter: squadFilter });
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadQuotations(lead._id, { branchId: req.branchId, query: req.query });
  res.json(result);
});

const getLeadNotesList = asyncHandler(async (req, res) => {
  const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
  const lead = await loadLeadCore(req.params.id, { branchId: req.branchId, extraFilter: squadFilter });
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadNotes(lead._id, { query: req.query });
  res.json(result);
});

/** Team leaders: reassign within squad only — no editing lead fields. */
const updateLead = asyncHandler(async (req, res) => {
  const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
  const lead = await Lead.findOne({
    _id: req.params.id,
    ...squadFilter,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(403, 'Not a team lead');

  const executiveId = req.body.executiveId;
  const otherFields = Object.keys(req.body).filter((k) => k !== 'executiveId');
  if (otherFields.length > 0) {
    throw new ApiError(403, 'Team leaders cannot edit lead details');
  }
  if (!executiveId) throw new ApiError(400, 'executiveId is required to reassign');

  const execIds = await getExecutiveIdsForLeader(req.user._id);
  if (!execIds.some((id) => id.toString() === executiveId)) {
    throw new ApiError(403, 'Executive not in your team');
  }
  lead.assignedTo = executiveId;
  lead.assigneeRole = 'sales_executive';
  stampExecutiveAssignment(lead);
  const team = await getTeamForLeader(req.user._id);
  if (team) {
    lead.teamId = team._id;
    lead.assignedTeamLeader = req.user._id;
  }
  await lead.save();

  notifyLeadAssigned({
    assigneeId: executiveId,
    leadIds: [lead._id],
    leadNames: [lead.name],
    assignedBy: req.user,
  }).catch(() => {});

  const populated = await Lead.findById(lead._id).populate(LEAD_POPULATE).lean();
  res.json(enrichLead(populated));
});

const addLeadComment = asyncHandler(async (req, res) => {
  const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
  const lead = await Lead.findOne({
    _id: req.params.id,
    ...squadFilter,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const comment = `[TL ${new Date().toLocaleDateString('en-IN')}] ${req.body.text}`;
  lead.notes = `${lead.notes || ''}\n${comment}`.trim();
  await lead.save();

  res.json({ message: 'Comment added' });
});

const listFollowUps = asyncHandler(async (req, res) => {
  const execIds = await getExecutiveIdsForLeader(req.user._id);
  const myLeadIds = await Lead.find({
    assignedTo: { $in: execIds },
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).distinct('_id');
  const result = await findScopedFollowUpsPaginated(
    { $or: [{ assignedTo: { $in: execIds } }, { lead: { $in: myLeadIds } }] },
    req.query,
    { branchId: req.branchId }
  );
  res.json(result);
});

const listExecutives = asyncHandler(async (req, res) => {
  const team = await getTeamForLeader(req.user._id);
  if (!team) {
    res.json([]);
    return;
  }

  const execMembers = team.members.filter((m) => m.role === 'sales_executive');
  const performance = await Promise.all(
    execMembers.map(async (ex) => {
      const exId = ex._id;
      const [assignedLeads, followUpsDone, quotationsSent, conversions, revenue, contacted] = await Promise.all([
        Lead.countDocuments({ assignedTo: exId, ...(req.branchId ? { branchId: req.branchId } : {}) }),
        FollowUp.countDocuments({
          assignedTo: exId,
          status: 'completed',
          ...(req.branchId ? { branchId: req.branchId } : {}),
        }),
        Quotation.countDocuments({ createdByExecutive: exId, ...(req.branchId ? { branchId: req.branchId } : {}) }),
        Lead.countDocuments({
          assignedTo: exId,
          status: 'converted',
          ...(req.branchId ? { branchId: req.branchId } : {}),
        }),
        sumConvertedPackageRevenue({ assigneeId: exId, branchId: req.branchId }),
        Lead.countDocuments({
          assignedTo: exId,
          status: { $ne: 'new' },
          ...(req.branchId ? { branchId: req.branchId } : {}),
        }),
      ]);

      const targetStats = buildTargetProgress(revenue, await getMonthlyTarget(exId));

      return {
        _id: ex._id,
        name: ex.name,
        email: ex.email,
        assignedLeads,
        followUpsDone,
        quotationsSent,
        conversions,
        revenue,
        conversionRate: assignedLeads ? Math.round((conversions / assignedLeads) * 1000) / 10 : 0,
        contacted,
        monthlyTarget: targetStats.monthlyTarget,
        targetProgress: targetStats.progress,
      };
    })
  );

  performance.sort((a, b) => b.revenue - a.revenue).forEach((e, i) => {
    e.rank = i + 1;
  });

  res.json(performance);
});

const listQuotations = asyncHandler(async (req, res) => {
  const execIds = await getExecutiveIdsForLeader(req.user._id);
  const myLeadIds = await Lead.find({
    assignedTo: { $in: execIds },
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).distinct('_id');

  const filter = { lead: { $in: myLeadIds } };
  const segment = req.params.segment;
  if (segment === 'pending') filter.status = 'pending_approval';
  else if (segment === 'negotiation') filter.status = 'negotiation';
  else if (segment === 'approved') filter.status = 'approved';
  else if (segment === 'rejected') filter.status = 'rejected';

  const result = await findScopedQuotationsPaginated(filter, req.query, { branchId: req.branchId });
  res.json(result);
});

const createQuotation = asyncHandler(async (req, res) => {
  const execIds = await getExecutiveIdsForLeader(req.user._id);
  const lead = await Lead.findOne({
    _id: req.body.leadId,
    assignedTo: { $in: execIds },
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(403, 'Lead not in your team');

  const status = req.body.status === 'draft' ? 'draft' : 'approved';
  const now = new Date();
  const timeline = [
    { type: 'created', date: now, user: req.user.name, notes: 'Quote created by Team Leader' },
  ];
  if (status === 'approved') {
    timeline.push({
      type: 'approved',
      date: now,
      user: req.user.name,
      notes: 'Approved by Team Leader',
    });
  }

  const populated = await persistQuotation({
    req,
    lead,
    body: req.body,
    status,
    timeline,
    createdByExecutiveId: lead.assignedTo,
    teamLeaderId: req.user._id,
    approvalNote: status === 'approved' ? 'Created and approved by Team Leader' : 'Saved quote draft',
  });
  res.status(201).json(populated);
});

const approveQuotation = asyncHandler(async (req, res) => {
  const execIds = await getExecutiveIdsForLeader(req.user._id);
  const quotation = await Quotation.findOne({
    _id: req.params.id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).populate('lead');
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  const leadAssignee = quotation.lead?.assignedTo?.toString();
  if (!execIds.some((id) => id.toString() === leadAssignee)) {
    throw new ApiError(403, 'Not in your team');
  }

  const { action, notes } = req.body;
  const now = new Date();

  if (action === 'approve') {
    const { snapshotCosting1, buildCosting2, applyCosting2ToQuotation, buildQuotePackageSummary } =
      require('../services/quotationApprovalCostingService');
    if (!quotation.costing1) quotation.costing1 = snapshotCosting1(quotation);
    if (!quotation.packageSummary) {
      quotation.packageSummary = buildQuotePackageSummary(quotation);
    }
    const pct =
      req.body.costingPercent != null
        ? Number(req.body.costingPercent)
        : Number(quotation.costing1?.markupPercent || quotation.pricing?.markupPercent || 0);
    const costing2 = buildCosting2({
      quotation,
      markupPercent: pct,
      actor: req.user,
    });
    applyCosting2ToQuotation(quotation, costing2);
    quotation.status = 'approved';
    quotation.approvedBy = req.user._id;
    quotation.approvedAt = now;
    quotation.timeline.push({
      type: 'approved',
      date: now,
      user: req.user.name,
      notes:
        notes ||
        `Approved by Team Leader · Costing 2 @ ${costing2.markupPercent}% (₹${Number(costing2.grandTotal).toLocaleString('en-IN')})`,
    });
  } else if (action === 'reject') {
    quotation.status = 'rejected';
    quotation.timeline.push({
      type: 'rejected',
      date: now,
      user: req.user.name,
      notes: notes || 'Rejected by Team Leader',
    });
  } else if (action === 'changes') {
    quotation.status = 'draft';
    quotation.timeline.push({
      type: 'changes_requested',
      date: now,
      user: req.user.name,
      notes: notes || 'Changes requested — sent back to executive',
    });
  } else {
    throw new ApiError(400, 'Invalid action');
  }

  await quotation.save();
  const populated = await Quotation.findById(quotation._id).populate(QUOTATION_POPULATE).lean();
  const leadDoc = populated.lead;

  if (action === 'approve') {
    notifyQuotationApproved(populated, leadDoc, req.user).catch(() => {});
  } else if (action === 'reject') {
    notifyQuotationRejected(populated, leadDoc, req.user).catch(() => {});
  }
  res.json(populated);
});

const getEscalations = asyncHandler(async (req, res) => {
  const squadFilter = await getLeaderLeadScopeFilter(req.user._id);
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);

  const teamLeads = await Lead.find({
    ...squadFilter,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    status: { $in: ['follow_up', 'negotiation', 'quotation_sent'] },
    updatedAt: { $lt: fiveDaysAgo },
    isDeleted: { $ne: true },
  })
    .select('-notes')
    .populate(LEAD_LIST_POPULATE)
    .limit(50)
    .lean();

  const highValue = await Lead.find({
    ...squadFilter,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    budget: { $gte: 200000 },
    status: { $nin: ['converted', 'lost', 'booked_from_another_company'] },
    isDeleted: { $ne: true },
  })
    .select('-notes')
    .populate(LEAD_LIST_POPULATE)
    .sort({ budget: -1, updatedAt: -1 })
    .limit(50)
    .lean();

  res.json({
    stuck: teamLeads.map((l) => ({
      ...enrichLead(l),
      reason: 'No progress in 5+ days',
      daysStuck: Math.floor((Date.now() - new Date(l.updatedAt).getTime()) / 86400000),
      escalated: false,
    })),
    highValue: highValue.map((l) => ({
      ...enrichLead(l),
      reason: `High value — ₹${((l.budget || 0) / 100000).toFixed(1)}L budget`,
      escalated: false,
    })),
    complaints: [],
  });
});

const escalate = asyncHandler(async (req, res) => {
  await logActivity({
    type: 'escalation',
    user: req.user.name,
    userId: req.user._id,
    action: 'Escalated to Sales Manager',
    target: req.body.leadName || req.body._id,
    ip: getClientIp(req),
    branchId: req.branchId || req.user.branchId || null,
  });

  res.json({ message: 'Escalated to Sales Manager', escalatedAt: new Date().toISOString() });
});

const getReports = asyncHandler(async (req, res) => {
  const dash = await buildTeamLeaderDashboard(req.user._id, { branchId: req.branchId });
  const execIds = await getExecutiveIdsForLeader(req.user._id);

  const executives = await Promise.all(
    execIds.map(async (exId) => {
      const ex = await User.findOne({
        _id: exId,
        ...(req.branchId ? { branchId: req.branchId } : {}),
      })
        .select('name email')
        .lean();
      const [assignedLeads, conversions, revenue] = await Promise.all([
        Lead.countDocuments({ assignedTo: exId, ...(req.branchId ? { branchId: req.branchId } : {}) }),
        Lead.countDocuments({
          assignedTo: exId,
          status: 'converted',
          ...(req.branchId ? { branchId: req.branchId } : {}),
        }),
        sumConvertedPackageRevenue({ assigneeId: exId, branchId: req.branchId }),
      ]);
      return {
        ...ex,
        assignedLeads,
        conversions,
        revenue,
        conversionRate: assignedLeads ? Math.round((conversions / assignedLeads) * 1000) / 10 : 0,
      };
    })
  );

  res.json({
    teamPerformance: {
      totalLeads: dash.kpis.teamLeads,
      conversions: dash.kpis.teamConversions,
      revenue: dash.kpis.teamRevenue,
      avgConversionRate: dash.kpis.conversionRate,
    },
    executives,
    conversions: dash.conversionFunnel,
    leadSources: dash.leadSources.map((s) => ({
      source: s.source,
      leads: s.count,
      converted: Math.round(s.count * 0.28),
      rate: 28,
    })),
    reactivationWidget: dash.reactivationWidget,
  });
});

const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const baseFilter = {
    user: req.user._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  };
  const search = req.query.search?.trim();
  const filter = search
    ? {
        ...baseFilter,
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
        ],
      }
    : baseFilter;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);
  res.json(paginatedResponse(notifications.map(formatNotification), { page, limit, total }));
});

const getProfile = asyncHandler(async (req, res) => {
  const dash = await getOrSetFresh(
    req,
    cacheKey('team_leader', `${req.user._id}:${req.branchId || 'all'}`),
    () => buildTeamLeaderDashboard(req.user._id, { branchId: req.branchId }),
    60 * 1000
  );
  const team = await getTeamForLeader(req.user._id);
  const execIds = await getExecutiveIdsForLeader(req.user._id);

  const activity = await ActivityLog.find({
    $or: [{ userId: req.user._id }, { userId: { $in: execIds } }],
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const perf = await Promise.all(
    execIds.map(async (exId) => {
      const ex = await User.findOne({
        _id: exId,
        ...(req.branchId ? { branchId: req.branchId } : {}),
      })
        .select('name email')
        .lean();
      const [assignedLeads, conversions, revenue] = await Promise.all([
        Lead.countDocuments({ assignedTo: exId, ...(req.branchId ? { branchId: req.branchId } : {}) }),
        Lead.countDocuments({
          assignedTo: exId,
          status: 'converted',
          ...(req.branchId ? { branchId: req.branchId } : {}),
        }),
        sumConvertedPackageRevenue({ assigneeId: exId, branchId: req.branchId }),
      ]);
      return {
        ...ex,
        assignedLeads,
        conversions,
        revenue,
      };
    })
  );

  res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      roleName: 'Team Leader',
      department: req.user.department || 'Sales',
    },
    teamStats: dash.kpis,
    personalStats: {
      teamSize: team?.members?.length || execIds.length,
      escalationsThisMonth: 0,
      coachingSessions: 0,
    },
    activity,
    executives: perf.sort((a, b) => b.revenue - a.revenue),
  });
});

const getCalendar = asyncHandler(async (req, res) => {
  const execIds = await getExecutiveIdsForLeader(req.user._id);
  const myLeadIds = await Lead.find({
    assignedTo: { $in: execIds },
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).distinct('_id');

  const [followups, travelLeads] = await Promise.all([
    FollowUp.find({
      $or: [{ assignedTo: { $in: execIds } }, { lead: { $in: myLeadIds } }],
      ...(req.branchId ? { branchId: req.branchId } : {}),
    })
      .populate('lead', 'name')
      .populate('assignedTo', 'name')
      .lean(),
    Lead.find({
      assignedTo: { $in: execIds },
      travelDate: { $exists: true, $ne: null },
      ...(req.branchId ? { branchId: req.branchId } : {}),
    })
      .populate('assignedTo', 'name')
      .lean(),
  ]);

  const fuEvents = followups.map((f) => ({
    _id: f._id,
    title: `${f.assignedTo?.name}: ${f.lead?.name}`,
    start: f.scheduledAt,
    type: 'followup',
    executive: f.assignedTo?.name,
  }));

  const travelEvents = travelLeads.map((l) => ({
    _id: `travel-${l._id}`,
    title: `Travel: ${l.name}`,
    start: l.travelDate,
    type: 'travel',
    executive: l.assignedTo?.name,
  }));

  res.json([...fuEvents, ...travelEvents]);
});

module.exports = {
  getDashboard,
  getMyTeam,
  listLeads,
  getLeadDetail,
  getLeadQuotationsList,
  getLeadNotesList,
  updateLead,
  addLeadComment,
  listFollowUps,
  listExecutives,
  listQuotations,
  createQuotation,
  approveQuotation,
  getEscalations,
  escalate,
  getReports,
  listNotifications,
  getProfile,
  getCalendar,
};
