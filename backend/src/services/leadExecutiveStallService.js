const Lead = require('../models/Lead');

const STALL_MINUTES = 20;
const TERMINAL_STATUSES = ['lost', 'booked_from_another_company', 'converted'];

function stampExecutiveAssignment(target = {}) {
  const now = new Date();
  target.assignedAt = now;
  target.executiveLastViewedAt = null;
  return target;
}

async function markLeadViewedByExecutive(leadId, executiveId) {
  await Lead.updateOne(
    { _id: leadId, assignedTo: executiveId },
    { $set: { executiveLastViewedAt: new Date() } }
  );
}

function computeExecutiveStallFlags(lead, now = new Date()) {
  const inactive = {
    executiveStallActive: false,
    executiveStallReason: null,
    executiveStallMinutes: 0,
  };

  if (!lead?.assignedTo) return inactive;
  if (TERMINAL_STATUSES.includes(lead.status)) return inactive;
  if (lead.lastFollowUp || lead.nextFollowUp) return inactive;

  const assignedAt = lead.assignedAt || lead.createdAt;
  if (!assignedAt) return inactive;

  const msSinceAssignment = now.getTime() - new Date(assignedAt).getTime();
  if (msSinceAssignment < STALL_MINUTES * 60 * 1000) return inactive;

  const lastViewed = lead.executiveLastViewedAt ? new Date(lead.executiveLastViewedAt) : null;
  const notViewedInWindow =
    !lastViewed || now.getTime() - lastViewed.getTime() >= STALL_MINUTES * 60 * 1000;

  if (!notViewedInWindow) return inactive;

  const minutesSinceView = lastViewed
    ? Math.floor((now.getTime() - lastViewed.getTime()) / 60000)
    : Math.floor(msSinceAssignment / 60000);

  const executiveName = lead.assignedTo?.name || 'Executive';

  return {
    executiveStallActive: true,
    executiveStallReason: lastViewed
      ? `${executiveName} has not viewed this lead in ${minutesSinceView} minutes and no follow-up has been added`
      : `${executiveName} has not viewed this lead yet and no follow-up has been added`,
    executiveStallMinutes: minutesSinceView,
  };
}

module.exports = {
  STALL_MINUTES,
  stampExecutiveAssignment,
  markLeadViewedByExecutive,
  computeExecutiveStallFlags,
};
