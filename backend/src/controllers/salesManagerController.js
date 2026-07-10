const Lead = require('../models/Lead');
const LeadNote = require('../models/LeadNote');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Team = require('../models/Team');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { buildSalesManagerDashboard } = require('../services/dashboardService');
const { persistQuotation } = require('../services/quotationCreateService');
const { logActivity, getClientIp } = require('../services/activityService');
const {
  notifyLeadAssigned,
  notifyQuotationApproved,
  notifyQuotationRejected,
} = require('../services/notificationService');
const { getMonthlyTarget, buildTargetProgress } = require('../services/salesTargetService');
const {
  loadLeadCore,
  loadLeadRelated,
  loadLeadNotes,
  loadLeadQuotations,
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
} = require('../utils/queryHelpers');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { sumConvertedPackageRevenue } = require('../utils/convertedPackageRevenue');
const { stampExecutiveAssignment } = require('../services/leadExecutiveStallService');
const { getOrSetFresh, cacheKey } = require('../services/dashboardCacheService');
const {
  findManagerLeadsPaginated,
  findScopedFollowUpsPaginated,
  findScopedQuotationsPaginated,
} = require('../repositories/roleScopedRepository');

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await getOrSetFresh(
    req,
    cacheKey('sales_manager', `dashboard:${req.branchId || 'all'}`),
    () => buildSalesManagerDashboard({ branchId: req.branchId }),
    60 * 1000
  );
  res.json(stats);
});

const listLeads = asyncHandler(async (req, res) => {
  const result = await findManagerLeadsPaginated(req.query, { branchId: req.branchId });
  res.json(result);
});

const getLeadDetail = asyncHandler(async (req, res) => {
  const lead = await loadLeadCore(req.params.id, { branchId: req.branchId });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const includeRelated = req.query.includeRelated === '1' || req.query.includeRelated === 'true';
  if (!includeRelated) {
    res.json(enrichLead(lead));
    return;
  }

  const [related, notes] = await Promise.all([
    loadLeadRelated(lead._id, { branchId: req.branchId }),
    loadLeadNotes(lead._id, { query: { page: 1, limit: 20 } }),
  ]);
  res.json({
    ...enrichLead(lead),
    ...related,
    notesList: notes.notes,
    notesTotal: notes.notesTotal,
  });
});

const getLeadQuotationsList = asyncHandler(async (req, res) => {
  const lead = await loadLeadCore(req.params.id, { branchId: req.branchId });
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadQuotations(lead._id, { branchId: req.branchId, query: req.query });
  res.json(result);
});

const getLeadNotesList = asyncHandler(async (req, res) => {
  const lead = await loadLeadCore(req.params.id, { branchId: req.branchId });
  if (!lead) throw new ApiError(404, 'Lead not found');
  const result = await loadLeadNotes(lead._id, { query: req.query });
  res.json(result);
});

const assignLeads = asyncHandler(async (req, res) => {
  const ids = req.body.leadIds || (req.body.leadId ? [req.body.leadId] : []);
  if (!ids.length) throw new ApiError(400, 'No leads selected');

  if (!req.body.executiveId) {
    throw new ApiError(400, 'Please select an executive to assign the lead');
  }

  const patch = {};

  if (req.body.executiveId) {
    const executive = await User.findOne({
      _id: req.body.executiveId,
      ...(req.branchId ? { branchId: req.branchId } : {}),
    });
    if (!executive) throw new ApiError(404, 'Executive not found');
    patch.assignedTo = executive._id;
    patch.assigneeRole = 'sales_executive';
    stampExecutiveAssignment(patch);
  }

  if (req.body.teamId) {
    const team = await Team.findOne({
      _id: req.body.teamId,
      ...(req.branchId ? { branchId: req.branchId } : {}),
    }).populate('teamLeader', 'name');
    if (!team) throw new ApiError(404, 'Team not found');
    patch.teamId = team._id;
    if (team.teamLeader) patch.assignedTeamLeader = team.teamLeader._id;
  }

  await Lead.updateMany(
    { _id: { $in: ids }, ...(req.branchId ? { branchId: req.branchId } : {}) },
    patch
  );

  await logActivity({
    type: 'lead_assigned',
    user: req.user.name,
    userId: req.user._id,
    action: `Assigned ${ids.length} lead(s)`,
    target: req.body.executiveId || 'team',
    ip: getClientIp(req),
    branchId: req.branchId || req.user.branchId || null,
  });

  const team = req.body.teamId
    ? await Team.findOne({
        _id: req.body.teamId,
        ...(req.branchId ? { branchId: req.branchId } : {}),
      }).select('name')
    : null;
  const executive = req.body.executiveId
    ? await User.findOne({
        _id: req.body.executiveId,
        ...(req.branchId ? { branchId: req.branchId } : {}),
      }).select('name')
    : null;

  if (req.body.executiveId) {
    notifyLeadAssigned({
      assigneeId: req.body.executiveId,
      assigneeName: executive?.name,
      leadIds: ids,
      assignedBy: req.user,
    }).catch(() => {});
  }

  res.json({
    message: 'Leads assigned',
    count: ids.length,
    team: team?.name,
    executive: executive?.name,
  });
});

const listExecutives = asyncHandler(async (req, res) => {
  const executives = await User.find({
    role: 'sales_executive',
    status: 'active',
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .select('name email')
    .lean();

  const performance = await Promise.all(
    executives.map(async (ex) => {
      const exId = ex._id;
      const [
        assignedLeads,
        followUpsDone,
        quotationsSent,
        conversions,
        revenueAgg,
        contacted,
      ] = await Promise.all([
        Lead.countDocuments({ assignedTo: exId }),
        FollowUp.countDocuments({
          $or: [{ assignedTo: exId }, { createdBy: exId }],
          status: 'completed',
        }),
        Quotation.countDocuments({ createdByExecutive: exId }),
        Lead.countDocuments({ assignedTo: exId, status: 'converted' }),
        sumConvertedPackageRevenue({ assigneeId: exId }),
        Lead.countDocuments({ assignedTo: exId, status: { $ne: 'new' } }),
      ]);

      const targetStats = buildTargetProgress(revenueAgg, await getMonthlyTarget(exId));

      return {
        _id: ex._id,
        name: ex.name,
        email: ex.email,
        assignedLeads,
        leads: assignedLeads,
        followUpsDone,
        quotationsSent,
        conversions,
        converted: conversions,
        revenue: revenueAgg,
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

const listFollowUps = asyncHandler(async (req, res) => {
  const result = await findScopedFollowUpsPaginated({}, req.query, { branchId: req.branchId });
  res.json(result);
});

const listQuotations = asyncHandler(async (req, res) => {
  const segment = req.params.segment;
  const filter = {};

  if (segment === 'pending') {
    filter.status = { $in: ['sent', 'negotiation', 'pending_approval'] };
  } else if (segment === 'approved') {
    filter.status = 'approved';
  } else if (segment === 'rejected') {
    filter.status = 'rejected';
  }

  const mapRow = (q) => ({
    ...q,
    executive: q.createdByExecutive?.name || q.lead?.assignedTo?.name,
    approvalStatus: q.status === 'negotiation' ? 'pending_approval' : q.status,
  });

  const result = await findScopedQuotationsPaginated(filter, req.query, { mapRow, branchId: req.branchId });
  res.json(result);
});

const createQuotation = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.body.leadId,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const status = req.body.status === 'draft' ? 'draft' : 'approved';
  const now = new Date();
  const timeline = [
    { type: 'created', date: now, user: req.user.name, notes: 'Quote created by Sales Manager' },
  ];
  if (status === 'approved') {
    timeline.push({
      type: 'approved',
      date: now,
      user: req.user.name,
      notes: 'Approved by Sales Manager',
    });
  }

  const populated = await persistQuotation({
    req,
    lead,
    body: req.body,
    status,
    timeline,
    createdByExecutiveId: lead.assignedTo,
    teamLeaderId: body.teamLeader,
    approvalNote: status === 'approved' ? 'Created and approved by Sales Manager' : 'Saved quote draft',
  });
  res.status(201).json(populated);
});

const updateQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findOne({
    _id: req.params.id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  const { action, notes } = req.body;
  const now = new Date();

  if (action === 'approve') {
    quotation.status = 'approved';
    quotation.approvedBy = req.user._id;
    quotation.timeline.push({
      type: 'approved',
      date: now,
      user: req.user.name,
      notes: notes || 'Approved by Sales Manager',
    });
  } else if (action === 'reject') {
    quotation.status = 'rejected';
    quotation.timeline.push({
      type: 'rejected',
      date: now,
      user: req.user.name,
      notes: notes || 'Rejected by Sales Manager',
    });
  } else if (action === 'changes') {
    quotation.status = 'draft';
    quotation.timeline.push({
      type: 'changes_requested',
      date: now,
      user: req.user.name,
      notes: notes || 'Changes requested',
    });
  } else {
    Object.assign(quotation, req.body);
  }

  await quotation.save();
  const populated = await Quotation.findById(quotation._id).populate(QUOTATION_POPULATE).lean();
  const lead = populated.lead;

  if (action === 'approve') {
    notifyQuotationApproved(populated, lead, req.user).catch(() => {});
  } else if (action === 'reject') {
    notifyQuotationRejected(populated, lead, req.user).catch(() => {});
  }

  res.json(populated);
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

const getReports = asyncHandler(async (req, res) => {
  const [executives, sourceAgg, statusAgg] = await Promise.all([
    User.find({
      role: 'sales_executive',
      status: 'active',
      ...(req.branchId ? { branchId: req.branchId } : {}),
    }).lean(),
    Lead.aggregate([
      ...(req.branchId ? [{ $match: { branchId: req.branchId } }] : []),
      { $group: { _id: '$source', leads: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      ...(req.branchId ? [{ $match: { branchId: req.branchId } }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const execStats = await Promise.all(
    executives.map(async (ex) => {
      const [assignedLeads, conversions, revenue] = await Promise.all([
        Lead.countDocuments({ assignedTo: ex._id }),
        Lead.countDocuments({ assignedTo: ex._id, status: 'converted' }),
        sumConvertedPackageRevenue({ assigneeId: ex._id }),
      ]);
      return {
        _id: ex._id,
        name: ex.name,
        assignedLeads,
        leads: assignedLeads,
        conversions,
        converted: conversions,
        revenue,
        conversionRate: assignedLeads ? Math.round((conversions / assignedLeads) * 1000) / 10 : 0,
      };
    })
  );

  const stageMap = {
    new: 'New',
    contacted: 'Contacted',
    follow_up: 'Follow-up',
    quotation_sent: 'Quotation',
    negotiation: 'Negotiation',
    converted: 'Converted',
  };

  res.json({
    executives: execStats,
    leadSources: sourceAgg.map((s) => ({
      source: s._id || 'Other',
      leads: s.leads,
      converted: 0,
      rate: 0,
    })),
    conversions: statusAgg.map((s) => ({
      stage: stageMap[s._id] || s._id,
      count: s.count,
    })),
    reactivationWidget: (await buildSalesManagerDashboard({ branchId: req.branchId })).reactivationWidget,
  });
});

const getCalendar = asyncHandler(async (req, res) => {
  const followups = await FollowUp.find(req.branchId ? { branchId: req.branchId } : {})
    .populate('lead', 'name')
    .populate('assignedTo', 'name')
    .lean();

  res.json(
    followups.map((f) => ({
      _id: f._id,
      title: `Follow-up: ${f.lead?.name}`,
      start: f.scheduledAt,
      type: 'followup',
      executive: f.assignedTo?.name,
    }))
  );
});

module.exports = {
  getDashboard,
  listLeads,
  getLeadDetail,
  getLeadQuotationsList,
  getLeadNotesList,
  assignLeads,
  listExecutives,
  listFollowUps,
  listQuotations,
  createQuotation,
  updateQuotation,
  listNotifications,
  getReports,
  getCalendar,
};
