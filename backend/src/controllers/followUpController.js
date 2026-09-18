const FollowUp = require('../models/FollowUp');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  FOLLOWUP_POPULATE,
  startOfDay,
} = require('../utils/queryHelpers');
const { createFollowUpForLead, updateFollowUpRecord } = require('../services/followUpService');
const { findFollowUpsPaginated } = require('../repositories/followUpRepository');
const {
  getAdminFollowUpSummary,
  getMissedFollowUpsPreview,
  getTeamFollowUpReport,
} = require('../services/followUpSummaryService');

async function syncMissedFollowUps() {
  const todayStart = startOfDay();
  await FollowUp.updateMany(
    { status: 'pending', scheduledAt: { $lt: todayStart } },
    { status: 'missed' }
  );
}

const listFollowUps = asyncHandler(async (req, res) => {
  await syncMissedFollowUps();
  const result = await findFollowUpsPaginated(req.query, { branchId: req.branchId });
  res.json(result);
});

const getFollowUpSummary = asyncHandler(async (req, res) => {
  await syncMissedFollowUps();
  const [summary, missedPreview, teamReport] = await Promise.all([
    getAdminFollowUpSummary(req.branchId),
    getMissedFollowUpsPreview({}, 8),
    getTeamFollowUpReport(req.branchId),
  ]);
  res.json({ ...summary, missedPreview, teamReport });
});

const getFollowUp = asyncHandler(async (req, res) => {
  const followup = await FollowUp.findById(req.params.id).populate(FOLLOWUP_POPULATE).lean();
  if (!followup) throw new ApiError(404, 'Follow-up not found');
  res.json(followup);
});

const createFollowUp = asyncHandler(async (req, res) => {
  const populated = await createFollowUpForLead({ body: req.body, user: req.user });
  res.status(201).json(populated);
});

const updateFollowUp = asyncHandler(async (req, res) => {
  const followup = await FollowUp.findById(req.params.id);
  if (!followup) throw new ApiError(404, 'Follow-up not found');

  const populated = await updateFollowUpRecord({ followup, body: req.body, user: req.user });
  res.json(populated);
});

const deleteFollowUp = asyncHandler(async (req, res) => {
  const followup = await FollowUp.findById(req.params.id);
  if (!followup) throw new ApiError(404, 'Follow-up not found');
  const leadId = followup.lead;
  await followup.deleteOne();
  const { syncLeadFollowUpDates } = require('../utils/followUpHelpers');
  await syncLeadFollowUpDates(leadId);
  res.json({ message: 'Follow-up deleted' });
});

const markMissedFollowUps = asyncHandler(async (req, res) => {
  await syncMissedFollowUps();
  res.json({ message: 'Missed follow-ups updated' });
});

module.exports = {
  listFollowUps,
  getFollowUpSummary,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  markMissedFollowUps,
};
