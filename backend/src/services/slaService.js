const Lead = require('../models/Lead');
const { LEAD_POPULATE, enrichLead } = require('../utils/queryHelpers');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { logLeadActivity } = require('./leadActivityService');
const { notifySlaBreach } = require('./notificationService');
const {
  computeFirstContactDeadline,
  describeFirstContactSla,
} = require('./salesSopService');
const { FIRST_CONTACT_SLA } = require('../constants/salesSop');

async function processSlaBreaches() {
  const candidates = await Lead.find({
    isDeleted: { $ne: true },
    slaBreached: { $ne: true },
    firstContactAt: null,
    status: { $nin: ['lost', 'converted', 'booked_from_another_company'] },
  })
    .populate('assignedTo', 'name')
    .sort({ createdAt: 1 })
    .limit(80)
    .lean();

  const now = Date.now();
  let count = 0;

  for (const lead of candidates) {
    const deadline =
      (lead.firstContactDeadline && new Date(lead.firstContactDeadline)) ||
      computeFirstContactDeadline(lead);
    if (!deadline || deadline.getTime() > now) continue;

    await Lead.updateOne(
      { _id: lead._id },
      {
        slaBreached: true,
        firstContactDeadline: deadline,
      }
    );
    const slaLabel = describeFirstContactSla(lead);
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'sla_breached',
      description: `First-call SLA breached — ${slaLabel}`,
      actor: { name: 'System' },
      meta: { deadline, slaLabel },
    });
    await notifySlaBreach({ ...lead, _slaLabel: slaLabel });
    count += 1;
  }

  return count;
}

async function getSlaDashboard(branchId, { page = 1, limit = 20, tab = 'breached' } = {}) {
  const base = { isDeleted: { $ne: true }, ...(branchId ? { branchId } : {}) };
  const now = new Date();

  let filter = base;
  if (tab === 'breached') filter = { ...base, slaBreached: true };
  else if (tab === 'at_risk') {
    filter = {
      ...base,
      slaBreached: { $ne: true },
      firstContactAt: null,
      firstContactDeadline: {
        $gte: now,
        $lte: new Date(now.getTime() + 5 * 60 * 1000),
      },
    };
  } else if (tab === 'met') {
    filter = { ...base, firstContactAt: { $ne: null } };
  } else if (tab === 'pending') {
    filter = {
      ...base,
      slaBreached: { $ne: true },
      firstContactAt: null,
    };
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
      firstContactDeadline: {
        $gte: now,
        $lte: new Date(now.getTime() + 5 * 60 * 1000),
      },
    }),
    Lead.countDocuments({ ...base, firstContactAt: { $ne: null } }),
    Lead.countDocuments({ ...base, slaBreached: { $ne: true }, firstContactAt: null }),
  ]);

  const data = rows.map((l) => {
    const enriched = enrichLead(l);
    const deadline =
      (l.firstContactDeadline && new Date(l.firstContactDeadline)) ||
      computeFirstContactDeadline(l);
    const minutesLeft = deadline
      ? Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 60000))
      : 0;
    const minutesOverdue =
      l.slaBreached && deadline
        ? Math.floor((Date.now() - deadline.getTime()) / 60000)
        : 0;
    return {
      ...enriched,
      slaDeadline: deadline,
      minutesLeft: l.slaBreached ? 0 : minutesLeft,
      minutesOverdue,
      slaLabel: describeFirstContactSla(l),
      slaStatus: l.slaBreached
        ? 'breached'
        : l.firstContactAt
          ? 'met'
          : minutesLeft <= 5
            ? 'at_risk'
            : 'pending',
    };
  });

  return {
    ...paginatedResponse(data, { page, limit, total }),
    counts: { breached, atRisk, met, pending },
    slaMinutes: FIRST_CONTACT_SLA.hotMinutes,
    slaRules: FIRST_CONTACT_SLA,
  };
}

module.exports = {
  processSlaBreaches,
  getSlaDashboard,
  SLA_MINUTES: FIRST_CONTACT_SLA.hotMinutes,
  slaDeadline: (createdAt) =>
    computeFirstContactDeadline({ createdAt, temperature: 'warm' }, createdAt),
};
