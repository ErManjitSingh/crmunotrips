const { autoAssignLeadBySkill } = require('./skillAssignmentService');
const { autoAssignLead } = require('./destinationAssignmentService');
const { isLeadAutoAssignmentEnabled } = require('../config/assignment');

/**
 * Runs skill-based assignment first, then destination-based if still unassigned.
 */
async function runLeadAutoAssignment(lead, { triggeredBy } = {}) {
  if (!(await isLeadAutoAssignmentEnabled())) {
    return { success: false, reason: 'Auto lead assignment is disabled (manual assign only)' };
  }

  const skillResult = await autoAssignLeadBySkill(lead, { triggeredBy });
  if (skillResult.assigned) {
    return { ...skillResult, stage: 'skill' };
  }

  if (lead.assignedTo) {
    return { ...skillResult, stage: 'skill' };
  }

  const destinationResult = await autoAssignLead(lead, { triggeredBy });
  return { ...destinationResult, stage: 'destination' };
}

module.exports = { runLeadAutoAssignment };
