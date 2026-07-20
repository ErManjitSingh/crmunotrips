const HrEmployee = require('../models/hr/HrEmployee');
const HrPerformanceReview = require('../models/hr/HrPerformanceReview');
const HrJobOpening = require('../models/hr/HrJobOpening');
const HrCandidate = require('../models/hr/HrCandidate');
const HrInterview = require('../models/hr/HrInterview');
const HrIncentive = require('../models/hr/HrIncentive');
const ApiError = require('../utils/apiError');

const EMP_SEL = 'firstName lastName employeeCode';

/* ─── Performance ─── */
async function listPerformance(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.periodType) filter.periodType = query.periodType;
  if (query.status) filter.status = query.status;
  return HrPerformanceReview.find(filter)
    .populate({ path: 'employeeId', select: EMP_SEL })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Number(query.limit) || 50))
    .lean();
}

async function createPerformance(body, user) {
  if (!body?.employeeId || !body?.periodLabel?.trim()) {
    throw new ApiError(400, 'Employee and period label are required');
  }
  const emp = await HrEmployee.findOne({ _id: body.employeeId, isDeleted: { $ne: true } });
  if (!emp) throw new ApiError(404, 'Employee not found');
  return HrPerformanceReview.create({
    employeeId: body.employeeId,
    periodType: body.periodType || 'quarterly',
    periodLabel: body.periodLabel.trim(),
    rating: Number(body.rating) || 3,
    kpis: body.kpis || [],
    achievements: body.achievements || '',
    managerFeedback: body.managerFeedback || '',
    selfReview: body.selfReview || '',
    peerFeedback: body.peerFeedback || '',
    promotionSuggested: Boolean(body.promotionSuggested),
    status: body.status || 'draft',
    reviewedBy: user?._id || null,
  });
}

async function updatePerformance(id, body) {
  const row = await HrPerformanceReview.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Review not found');
  [
    'periodType',
    'periodLabel',
    'rating',
    'kpis',
    'achievements',
    'managerFeedback',
    'selfReview',
    'peerFeedback',
    'promotionSuggested',
    'status',
  ].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  await row.save();
  return row.populate({ path: 'employeeId', select: EMP_SEL });
}

async function deletePerformance(id) {
  const row = await HrPerformanceReview.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Review not found');
  return { success: true };
}

/* ─── Job openings ─── */
async function listJobs(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  return HrJobOpening.find(filter)
    .populate([
      { path: 'departmentId', select: 'name' },
      { path: 'designationId', select: 'name' },
    ])
    .sort({ createdAt: -1 })
    .lean();
}

async function createJob(body, user) {
  if (!body?.title?.trim()) throw new ApiError(400, 'Job title is required');
  return HrJobOpening.create({
    title: body.title.trim(),
    departmentId: body.departmentId || null,
    designationId: body.designationId || null,
    openings: Number(body.openings) || 1,
    location: body.location || '',
    employmentType: body.employmentType || 'full_time',
    description: body.description || '',
    requirements: body.requirements || '',
    status: body.status || 'open',
    createdBy: user?._id || null,
  });
}

async function updateJob(id, body) {
  const row = await HrJobOpening.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Job opening not found');
  [
    'title',
    'departmentId',
    'designationId',
    'openings',
    'location',
    'employmentType',
    'description',
    'requirements',
    'status',
  ].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  if (body.status === 'closed' || body.status === 'filled') row.closedAt = new Date();
  await row.save();
  return row.populate([
    { path: 'departmentId', select: 'name' },
    { path: 'designationId', select: 'name' },
  ]);
}

async function deleteJob(id) {
  const row = await HrJobOpening.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, status: 'closed' } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Job opening not found');
  return { success: true };
}

/* ─── Candidates / Recruitment pipeline ─── */
async function listCandidates(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.jobOpeningId) filter.jobOpeningId = query.jobOpeningId;
  if (query.stage) filter.stage = query.stage;
  return HrCandidate.find(filter)
    .populate({ path: 'jobOpeningId', select: 'title status location' })
    .sort({ updatedAt: -1 })
    .limit(Math.min(100, Number(query.limit) || 60))
    .lean();
}

async function createCandidate(body) {
  if (!body?.jobOpeningId || !body?.firstName?.trim()) {
    throw new ApiError(400, 'Job opening and first name are required');
  }
  const job = await HrJobOpening.findOne({ _id: body.jobOpeningId, isDeleted: { $ne: true } });
  if (!job) throw new ApiError(404, 'Job opening not found');
  return HrCandidate.create({
    jobOpeningId: body.jobOpeningId,
    firstName: body.firstName.trim(),
    lastName: body.lastName || '',
    email: body.email || '',
    phone: body.phone || '',
    resumeUrl: body.resumeUrl || '',
    source: body.source || 'direct',
    stage: body.stage || 'applied',
    experienceYears: Number(body.experienceYears) || 0,
    currentCtc: Number(body.currentCtc) || 0,
    expectedCtc: Number(body.expectedCtc) || 0,
    notes: body.notes || '',
  });
}

async function updateCandidate(id, body) {
  const row = await HrCandidate.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Candidate not found');
  [
    'firstName',
    'lastName',
    'email',
    'phone',
    'resumeUrl',
    'source',
    'stage',
    'experienceYears',
    'currentCtc',
    'expectedCtc',
    'notes',
    'offerLetterUrl',
  ].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  await row.save();
  return row.populate({ path: 'jobOpeningId', select: 'title status location' });
}

async function deleteCandidate(id) {
  const row = await HrCandidate.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Candidate not found');
  return { success: true };
}

async function recruitmentFunnel() {
  const stages = HrCandidate.STAGES || ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
  const counts = await HrCandidate.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  return stages.map((s) => ({ stage: s, count: map[s] || 0 }));
}

/* ─── Interviews ─── */
async function listInterviews(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.candidateId) filter.candidateId = query.candidateId;
  if (query.upcoming === 'true') {
    filter.scheduledAt = { $gte: new Date() };
    filter.status = 'scheduled';
  }
  return HrInterview.find(filter)
    .populate([
      { path: 'candidateId', select: 'firstName lastName email phone stage' },
      { path: 'jobOpeningId', select: 'title' },
    ])
    .sort({ scheduledAt: 1 })
    .limit(Math.min(100, Number(query.limit) || 50))
    .lean();
}

async function createInterview(body, user) {
  if (!body?.candidateId || !body?.scheduledAt) {
    throw new ApiError(400, 'Candidate and schedule time are required');
  }
  const candidate = await HrCandidate.findOne({ _id: body.candidateId, isDeleted: { $ne: true } });
  if (!candidate) throw new ApiError(404, 'Candidate not found');
  const interview = await HrInterview.create({
    candidateId: body.candidateId,
    jobOpeningId: body.jobOpeningId || candidate.jobOpeningId,
    round: body.round || 'Round 1',
    scheduledAt: body.scheduledAt,
    interviewer: body.interviewer || '',
    mode: body.mode || 'video',
    status: 'scheduled',
    createdBy: user?._id || null,
  });
  if (candidate.stage === 'applied' || candidate.stage === 'screening') {
    candidate.stage = 'interview';
    await candidate.save();
  }
  return interview.populate([
    { path: 'candidateId', select: 'firstName lastName email phone stage' },
    { path: 'jobOpeningId', select: 'title' },
  ]);
}

async function updateInterview(id, body) {
  const row = await HrInterview.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Interview not found');
  ['round', 'scheduledAt', 'interviewer', 'mode', 'status', 'rating', 'feedback', 'recommendation'].forEach(
    (k) => {
      if (body[k] !== undefined) row[k] = body[k];
    }
  );
  await row.save();
  return row.populate([
    { path: 'candidateId', select: 'firstName lastName email phone stage' },
    { path: 'jobOpeningId', select: 'title' },
  ]);
}

async function deleteInterview(id) {
  const row = await HrInterview.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Interview not found');
  return { success: true };
}

async function countUpcomingInterviews() {
  return HrInterview.countDocuments({
    isDeleted: { $ne: true },
    status: 'scheduled',
    scheduledAt: { $gte: new Date() },
  });
}

/* ─── Incentives ─── */
async function listIncentives(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.employeeId) filter.employeeId = query.employeeId;
  return HrIncentive.find(filter)
    .populate({ path: 'employeeId', select: EMP_SEL })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Number(query.limit) || 50))
    .lean();
}

async function createIncentive(body, user) {
  if (!body?.employeeId || !body?.title?.trim() || body.amount == null) {
    throw new ApiError(400, 'Employee, title and amount are required');
  }
  return HrIncentive.create({
    employeeId: body.employeeId,
    type: body.type || 'bonus',
    title: body.title.trim(),
    amount: Number(body.amount) || 0,
    periodLabel: body.periodLabel || '',
    notes: body.notes || '',
    createdBy: user?._id || null,
  });
}

async function reviewIncentive(id, body, user) {
  const row = await HrIncentive.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Incentive not found');
  if (!['approved', 'paid', 'rejected'].includes(body.status)) {
    throw new ApiError(400, 'Invalid status');
  }
  row.status = body.status;
  if (body.notes !== undefined) row.notes = body.notes;
  if (body.status === 'approved' || body.status === 'rejected') {
    row.approvedBy = user?._id || null;
    row.approvedAt = new Date();
  }
  if (body.status === 'paid') row.paidAt = new Date();
  await row.save();
  return row.populate({ path: 'employeeId', select: EMP_SEL });
}

async function deleteIncentive(id) {
  const row = await HrIncentive.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true }, status: 'pending' },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Pending incentive not found');
  return { success: true };
}

module.exports = {
  listPerformance,
  createPerformance,
  updatePerformance,
  deletePerformance,
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  listCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  recruitmentFunnel,
  listInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
  countUpcomingInterviews,
  listIncentives,
  createIncentive,
  reviewIncentive,
  deleteIncentive,
};
