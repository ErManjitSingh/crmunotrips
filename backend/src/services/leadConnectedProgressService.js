const Lead = require('../models/Lead');
const { logLeadActivity } = require('./leadActivityService');

const CONNECTED_TO_WIP_HOURS = 24;
const BATCH_LIMIT = 200;

/**
 * Connected (`contacted`) leads older than 24h auto-move to Working in Progress.
 * Uses `connectedAt`, falling back to `firstContactAt` / `updatedAt` for legacy rows.
 */
async function processConnectedToWorkingProgress() {
  const cutoff = new Date(Date.now() - CONNECTED_TO_WIP_HOURS * 60 * 60 * 1000);

  const stale = await Lead.find({
    isDeleted: { $ne: true },
    status: 'contacted',
    $or: [
      { connectedAt: { $lte: cutoff } },
      { connectedAt: null, firstContactAt: { $lte: cutoff } },
      {
        connectedAt: null,
        $or: [{ firstContactAt: null }, { firstContactAt: { $exists: false } }],
        updatedAt: { $lte: cutoff },
      },
    ],
  })
    .select('_id branchId status connectedAt firstContactAt name')
    .limit(BATCH_LIMIT);

  if (!stale.length) return { promoted: 0 };

  let promoted = 0;
  const now = new Date();

  for (const lead of stale) {
    const prev = lead.status;
    lead.status = 'working_progress';
    lead.statusReason = 'auto_connected_24h';
    lead.statusReasonUpdatedAt = now;
    if (!lead.connectedAt) {
      lead.connectedAt = lead.firstContactAt || lead.updatedAt || now;
    }
    await lead.save();
    promoted += 1;

    try {
      await logLeadActivity({
        leadId: lead._id,
        branchId: lead.branchId,
        type: 'status_changed',
        description: 'Auto-moved from Connected to Working in Progress after 24 hours',
        actor: null,
        meta: { from: prev, to: 'working_progress', reason: 'auto_connected_24h' },
      });
    } catch {
      /* non-blocking */
    }
  }

  if (promoted) {
    console.log(`[Connected→WIP] Promoted ${promoted} lead(s) after ${CONNECTED_TO_WIP_HOURS}h`);
  }

  return { promoted };
}

module.exports = {
  processConnectedToWorkingProgress,
  CONNECTED_TO_WIP_HOURS,
};
