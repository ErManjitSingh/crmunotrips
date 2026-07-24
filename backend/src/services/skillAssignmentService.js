const User = require('../models/User');
const LeadAssignmentLog = require('../models/LeadAssignmentLog');
const BranchAssignmentSettings = require('../models/BranchAssignmentSettings');
const { LEAD_SKILL_LABELS } = require('../config/leadSkills');
const { detectLeadType } = require('./leadTypeDetectionService');
const {
  filterEligibleExecutives,
  pickExecutive,
  applyExecutiveAssignment,
  applySalesManagerAssignment,
  advanceRoundRobin,
} = require('./assignmentCoreService');
const { notifyLeadAssigned } = require('./notificationService');
const { LEAD_AUTO_ASSIGNMENT_ENABLED } = require('../config/assignment');

async function getBranchSkillSettings(branchId) {
  if (!branchId) return null;
  let settings = await BranchAssignmentSettings.findOne({ branchId });
  if (!settings) {
    settings = await BranchAssignmentSettings.create({
      branchId,
      autoAssignEnabled: true,
      skillAutoAssignEnabled: true,
      fallbackUserIds: [],
      salesManagerQueueIds: [],
    });
  }
  return settings;
}

async function getExecutivesWithSkill(leadType, branchId) {
  return User.find({
    role: 'sales_executive',
    status: 'active',
    branchId,
    skills: leadType,
  })
    .select('name email role teamId branchId skills')
    .lean();
}

async function getSalesManagerQueue(branchId, settings) {
  const ids = settings?.salesManagerQueueIds || [];
  if (ids.length) {
    return User.find({
      _id: { $in: ids },
      role: 'sales_manager',
      status: 'active',
      branchId,
    })
      .select('name email role branchId')
      .lean();
  }

  return User.find({
    role: 'sales_manager',
    status: 'active',
    branchId,
  })
    .select('name email role branchId')
    .sort({ name: 1 })
    .lean();
}

async function pickSalesManager(managers, branchId) {
  if (!managers.length) return null;
  const sorted = [...managers].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const index = await advanceRoundRobin(`${branchId}:sales_manager_queue`, sorted.length);
  return sorted[index];
}

async function writeSkillAssignmentLog({
  lead,
  branchId,
  leadType,
  assignedTo,
  assigneeName,
  assignmentType,
  success,
  reason,
  ruleSnapshot,
  triggeredBy,
}) {
  return LeadAssignmentLog.create({
    leadId: lead._id,
    branchId: branchId || lead.branchId,
    leadDestination: lead.destination,
    leadType,
    assignedTo: assignedTo || null,
    assigneeName: assigneeName || null,
    assignmentType,
    success,
    reason,
    ruleSnapshot,
    triggeredBy: triggeredBy || null,
  });
}

async function autoAssignLeadBySkill(lead, { triggeredBy } = {}) {
  if (!LEAD_AUTO_ASSIGNMENT_ENABLED) {
    return { assigned: false, reason: 'auto_assignment_disabled' };
  }
  if (lead.assignedTo) {
    return { assigned: false, reason: 'already_assigned' };
  }

  const branchId = lead.branchId;
  if (!branchId) {
    await writeSkillAssignmentLog({
      lead,
      branchId: null,
      leadType: lead.leadType,
      assignmentType: 'unassigned',
      success: false,
      reason: 'Lead has no branch; cannot skill-assign',
      ruleSnapshot: {},
      triggeredBy,
    });
    return { assigned: false, reason: 'no_branch' };
  }

  const settings = await getBranchSkillSettings(branchId);
  if (settings?.skillAutoAssignEnabled === false) {
    return { assigned: false, reason: 'skill_disabled' };
  }

  const leadType = lead.leadType || detectLeadType(lead).leadType;
  if (!lead.leadType) {
    lead.leadType = leadType;
    await lead.save();
  }

  const pool = await getExecutivesWithSkill(leadType, branchId);
  const eligible = await filterEligibleExecutives(pool, branchId);

  const rules = ['match_branch', 'match_skill', 'active', 'present', 'lowest_leads', 'round_robin'];

  if (eligible.length) {
    const pick = await pickExecutive(eligible, {
      branchId,
      poolKey: `skill:${leadType}`,
    });

    await applyExecutiveAssignment(lead, pick.executive);

    await writeSkillAssignmentLog({
      lead,
      branchId,
      leadType,
      assignedTo: pick.executive._id,
      assigneeName: pick.executive.name,
      assignmentType: 'skill_match',
      success: true,
      reason: `Assigned to ${LEAD_SKILL_LABELS[leadType] || leadType} specialist`,
      ruleSnapshot: {
        leadType,
        leadTypeSource: lead.leadTypeSource,
        skillLabel: LEAD_SKILL_LABELS[leadType],
        poolSize: pool.length,
        tieBreaker: pick.tieBreaker,
        activeLeadCount: pick.activeLeadCount,
        candidates: pick.candidates,
        rules,
      },
      triggeredBy,
    });

    notifyLeadAssigned({
      assigneeId: pick.executive._id,
      leadIds: [lead._id],
      leadNames: [lead.name],
      assignedBy: triggeredBy || { name: 'Skill Auto Assignment' },
    }).catch(() => {});

    return { assigned: true, assignee: pick.executive, leadType, assignmentType: 'skill_match' };
  }

  const managers = await getSalesManagerQueue(branchId, settings);
  const manager = await pickSalesManager(managers, branchId);

  if (!manager) {
    await writeSkillAssignmentLog({
      lead,
      branchId,
      leadType,
      assignmentType: 'skill_match',
      success: false,
      reason: `No eligible ${LEAD_SKILL_LABELS[leadType] || leadType} executive present; sales manager queue empty`,
      ruleSnapshot: { leadType, poolSize: pool.length, rules },
      triggeredBy,
    });
    return { assigned: false, reason: 'no_skill_match_no_manager', leadType };
  }

  await applySalesManagerAssignment(lead, manager);

  await writeSkillAssignmentLog({
    lead,
    branchId,
    leadType,
    assignedTo: manager._id,
    assigneeName: manager.name,
    assignmentType: 'sales_manager_queue',
    success: true,
    reason: `No ${LEAD_SKILL_LABELS[leadType] || leadType} specialist available; routed to sales manager queue`,
    ruleSnapshot: {
      leadType,
      leadTypeSource: lead.leadTypeSource,
      poolSize: pool.length,
      managerQueueSize: managers.length,
      rules,
    },
    triggeredBy,
  });

  notifyLeadAssigned({
    assigneeId: manager._id,
    leadIds: [lead._id],
    leadNames: [lead.name],
    assignedBy: triggeredBy || { name: 'Skill Auto Assignment' },
  }).catch(() => {});

  return {
    assigned: true,
    assignee: manager,
    leadType,
    assignmentType: 'sales_manager_queue',
  };
}

async function getSkillAssignmentReport({ branchId, from, to } = {}) {
  const match = {
    ...(branchId ? { branchId } : {}),
    assignmentType: { $in: ['skill_match', 'sales_manager_queue'] },
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { $gte: new Date(from) } : {}),
            ...(to ? { $lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [byType, byLeadType, recentFailures] = await Promise.all([
    LeadAssignmentLog.aggregate([
      { $match: match },
      { $group: { _id: '$assignmentType', count: { $sum: 1 }, success: { $sum: { $cond: ['$success', 1, 0] } } } },
      { $sort: { count: -1 } },
    ]),
    LeadAssignmentLog.aggregate([
      { $match: { ...match, success: true, leadType: { $ne: null } } },
      { $group: { _id: '$leadType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    LeadAssignmentLog.find({ ...match, success: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('leadId', 'name leadId destination leadType')
      .lean(),
  ]);

  const total = await LeadAssignmentLog.countDocuments(match);
  const successful = await LeadAssignmentLog.countDocuments({ ...match, success: true });

  return { total, successful, failed: total - successful, byType, byLeadType, recentFailures };
}

module.exports = {
  autoAssignLeadBySkill,
  getSkillAssignmentReport,
  getBranchSkillSettings,
  getExecutivesWithSkill,
};
