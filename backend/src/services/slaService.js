const Lead = require('../models/Lead');
const { LEAD_POPULATE, enrichLead } = require('../utils/queryHelpers');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { logLeadActivity } = require('./leadActivityService');
const { notifySlaBreach } = require('./notificationService');

const SLA_MINUTES = 15;

function slaDeadline(createdAt) {
  return new Date(new Date(createdAt).getTime() + SLA_MINUTES * 60000);
}

async function processSlaBreaches() {
  const cutoff = new Date(Date.now() - SLA_MINUTES * 60000);
  const overdue = await Lead.find({
    isDeleted: { $ne: true },
    slaBreached: { $ne: true },
    firstContactAt: null,
    status: 'new',
    createdAt: { $lt: cutoff },
  })
    .populate('assignedTo', 'name')
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  for (const lead of overdue) {
    await Lead.updateOne({ _id: lead._id }, { slaBreached: true, slaContactedAt: null });
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'sla_breached',
      description: `SLA breached — no contact within ${SLA_MINUTES} minutes`,
      actor: { name: 'System' },
      meta: { slaMinutes: SLA_MINUTES },
    });
    await notifySlaBreach(lead);
  }

  return overdue.length;
}

async function getSlaDashboard(branchId, { page = 1, limit = 20, tab = 'breached' } = {}) {
  const base = { isDeleted: { $ne: true }, ...(branchId ? { branchId } : {}) };
  const now = new Date();
  const riskCutoff = new Date(Date.now() - SLA_MINUTES * 60000);

  let filter = base;
  if (tab === 'breached') filter = { ...base, slaBreached: true };
  else if (tab === 'at_risk') {
    filter = {
      ...base,
      slaBreached: { $ne: true },
      firstContactAt: null,
      status: 'new',
      createdAt: { $gte: riskCutoff, $lt: now },
    };
  } else if (tab === 'met') {
    filter = { ...base, firstContactAt: { $ne: null } };
  } else if (tab === 'pending') {
    filter = { ...base, slaBreached: { $ne: true }, firstContactAt: null, status: 'new' };
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [rows, total, breached, atRisk, met, pending] = await Promise.all([
    Lead.find(filter).populate(LEAD_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter),
    Lead.countDocuments({ ...base, slaBreached: true }),
    Lead.countDocuments({
      ...base,
      slaBreached: { $ne: true },
      firstContactAt: null,
      status: 'new',
      createdAt: { $gte: riskCutoff, $lt: now },
    }),
    Lead.countDocuments({ ...base, firstContactAt: { $ne: null } }),
    Lead.countDocuments({ ...base, slaBreached: { $ne: true }, firstContactAt: null, status: 'new' }),
  ]);

  const data = rows.map((l) => {
    const enriched = enrichLead(l);
    const deadline = slaDeadline(l.createdAt);
    const minutesLeft = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 60000));
    const minutesOverdue = l.slaBreached
      ? Math.floor((Date.now() - deadline.getTime()) / 60000)
      : 0;
    return {
      ...enriched,
      slaDeadline: deadline,
      minutesLeft: l.slaBreached ? 0 : minutesLeft,
      minutesOverdue,
      slaStatus: l.slaBreached ? 'breached' : l.firstContactAt ? 'met' : minutesLeft <= 5 ? 'at_risk' : 'pending',
    };
  });

  return {
    ...paginatedResponse(data, { page, limit, total }),
    counts: { breached, atRisk, met, pending },
    slaMinutes: SLA_MINUTES,
  };
}

module.exports = { processSlaBreaches, getSlaDashboard, SLA_MINUTES, slaDeadline };
