const Lead = require('../models/Lead');
const { LEAD_ACCEPT_MINUTES } = require('../constants/salesSop');
const { computeFirstContactDeadline } = require('./salesSopService');

const STALL_MINUTES = 20;
const TERMINAL_STATUSES = ['lost', 'booked_from_another_company', 'converted'];

function stampExecutiveAssignment(target = {}) {
  const now = new Date();
  target.assignedAt = now;
  target.executiveLastViewedAt = null;
  return target;
}

/** SOP: 2-min accept window + first-contact deadline */
function stampPendingAcceptance(target = {}, leadLike = {}) {
  const now = new Date();
  stampExecutiveAssignment(target);
  target.assignmentAcceptance = 'pending';
  target.assignmentAcceptBy = new Date(now.getTime() + LEAD_ACCEPT_MINUTES * 60 * 1000);
  target.acceptedAt = null;
  target.acceptanceMissedBy = null;
  target.acceptanceMissedName = '';
  target.acceptanceMissedAt = null;
  target.firstContactDeadline = computeFirstContactDeadline(
    { ...leadLike, ...target, assignedAt: target.assignedAt || now },
    target.assignedAt || now
  );
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

function buildExecutiveStallQuery(now = new Date()) {
  const assignedCutoff = new Date(now.getTime() - STALL_MINUTES * 60 * 1000);
  const viewCutoff = assignedCutoff;
  return {
    assignedTo: { $ne: null },
    status: { $nin: TERMINAL_STATUSES },
    lastFollowUp: null,
    nextFollowUp: null,
    $expr: {
      $and: [
        { $lte: [{ $ifNull: ['$assignedAt', '$createdAt'] }, assignedCutoff] },
        {
          $or: [
            { $eq: [{ $ifNull: ['$executiveLastViewedAt', null] }, null] },
            { $lte: ['$executiveLastViewedAt', viewCutoff] },
          ],
        },
      ],
    },
  };
}

module.exports = {
  STALL_MINUTES,
  TERMINAL_STATUSES,
  LEAD_ACCEPT_MINUTES,
  stampExecutiveAssignment,
  stampPendingAcceptance,
  markLeadViewedByExecutive,
  computeExecutiveStallFlags,
  buildExecutiveStallQuery,
};
