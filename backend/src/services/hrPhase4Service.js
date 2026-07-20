const HrEmployee = require('../models/hr/HrEmployee');
const HrDepartment = require('../models/hr/HrDepartment');
const HrLeaveRequest = require('../models/hr/HrLeaveRequest');
const HrEvent = require('../models/hr/HrEvent');
const HrTrainingCourse = require('../models/hr/HrTrainingCourse');
const HrTrainingEnrollment = require('../models/hr/HrTrainingEnrollment');
const HrExitCase = require('../models/hr/HrExitCase');
const HrSettings = require('../models/hr/HrSettings');
const HrExpense = require('../models/hr/HrExpense');
const HrPayrollRun = require('../models/hr/HrPayrollRun');
const HrCandidate = require('../models/hr/HrCandidate');
const HrAsset = require('../models/hr/HrAsset');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/apiError');
const { startOfDay, endOfDay } = require('../utils/queryHelpers');
const { recruitmentFunnel } = require('./hrTalentService');

const EMP_SEL = 'firstName lastName employeeCode status';

/* ─── Events ─── */
async function listEvents(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.upcoming === 'true') {
    filter.startAt = { $gte: new Date() };
    filter.status = { $in: ['upcoming', 'ongoing'] };
  }
  return HrEvent.find(filter).sort({ startAt: 1 }).limit(Math.min(100, Number(query.limit) || 50)).lean();
}

async function createEvent(body, user) {
  if (!body?.title?.trim() || !body?.startAt) throw new ApiError(400, 'Title and start date required');
  return HrEvent.create({
    title: body.title.trim(),
    type: body.type || 'company',
    description: body.description || '',
    location: body.location || '',
    startAt: body.startAt,
    endAt: body.endAt || null,
    isAllDay: Boolean(body.isAllDay),
    status: body.status || 'upcoming',
    createdBy: user?._id || null,
  });
}

async function updateEvent(id, body) {
  const row = await HrEvent.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Event not found');
  ['title', 'type', 'description', 'location', 'startAt', 'endAt', 'isAllDay', 'status'].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  await row.save();
  return row;
}

async function deleteEvent(id) {
  const row = await HrEvent.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Event not found');
  return { success: true };
}

/* ─── Training ─── */
async function listCourses(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  return HrTrainingCourse.find(filter).sort({ createdAt: -1 }).lean();
}

async function createCourse(body) {
  if (!body?.title?.trim()) throw new ApiError(400, 'Course title is required');
  return HrTrainingCourse.create({
    title: body.title.trim(),
    category: body.category || 'general',
    description: body.description || '',
    videoUrl: body.videoUrl || '',
    durationHours: Number(body.durationHours) || 1,
    status: body.status || 'active',
  });
}

async function deleteCourse(id) {
  const row = await HrTrainingCourse.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, status: 'archived' } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Course not found');
  return { success: true };
}

async function listEnrollments(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.courseId) filter.courseId = query.courseId;
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.status) filter.status = query.status;
  return HrTrainingEnrollment.find(filter)
    .populate([
      { path: 'courseId', select: 'title category durationHours' },
      { path: 'employeeId', select: EMP_SEL },
    ])
    .sort({ updatedAt: -1 })
    .lean();
}

async function enrollEmployee(body) {
  if (!body?.courseId || !body?.employeeId) throw new ApiError(400, 'Course and employee required');
  const existing = await HrTrainingEnrollment.findOne({
    courseId: body.courseId,
    employeeId: body.employeeId,
    isDeleted: { $ne: true },
  });
  if (existing) throw new ApiError(409, 'Already enrolled');
  return HrTrainingEnrollment.create({
    courseId: body.courseId,
    employeeId: body.employeeId,
    progressPct: 0,
    status: 'enrolled',
  });
}

async function updateEnrollment(id, body) {
  const row = await HrTrainingEnrollment.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Enrollment not found');
  if (body.progressPct !== undefined) {
    row.progressPct = Math.min(100, Math.max(0, Number(body.progressPct) || 0));
    if (row.progressPct > 0 && row.progressPct < 100) row.status = 'in_progress';
    if (row.progressPct >= 100) {
      row.status = 'completed';
      row.completedAt = new Date();
    }
  }
  if (body.status) row.status = body.status;
  if (body.certificateUrl !== undefined) row.certificateUrl = body.certificateUrl;
  if (body.status === 'completed') {
    row.progressPct = 100;
    row.completedAt = new Date();
  }
  await row.save();
  return row.populate([
    { path: 'courseId', select: 'title category durationHours' },
    { path: 'employeeId', select: EMP_SEL },
  ]);
}

/* ─── Exit ─── */
async function listExits(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  return HrExitCase.find(filter)
    .populate({ path: 'employeeId', select: EMP_SEL })
    .sort({ createdAt: -1 })
    .lean();
}

async function createExit(body, user) {
  if (!body?.employeeId || !body?.resignationDate) {
    throw new ApiError(400, 'Employee and resignation date required');
  }
  const emp = await HrEmployee.findOne({ _id: body.employeeId, isDeleted: { $ne: true } });
  if (!emp) throw new ApiError(404, 'Employee not found');

  const exit = await HrExitCase.create({
    employeeId: body.employeeId,
    resignationDate: body.resignationDate,
    lastWorkingDate: body.lastWorkingDate || null,
    noticePeriodDays: Number(body.noticePeriodDays) || 30,
    reason: body.reason || '',
    status: 'notice_period',
    createdBy: user?._id || null,
  });

  emp.status = 'on_notice';
  await emp.save();

  return exit.populate({ path: 'employeeId', select: EMP_SEL });
}

async function updateExit(id, body) {
  const row = await HrExitCase.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Exit case not found');
  [
    'lastWorkingDate',
    'noticePeriodDays',
    'reason',
    'status',
    'assetReturned',
    'clearanceDone',
    'settlementDone',
    'exitInterviewNotes',
    'experienceLetterUrl',
    'relievingLetterUrl',
  ].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  await row.save();

  if (body.status === 'completed') {
    await HrEmployee.findByIdAndUpdate(row.employeeId, { $set: { status: 'terminated' } });
  }
  if (body.status === 'withdrawn') {
    await HrEmployee.findByIdAndUpdate(row.employeeId, { $set: { status: 'active' } });
  }

  return row.populate({ path: 'employeeId', select: EMP_SEL });
}

async function deleteExit(id) {
  const row = await HrExitCase.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Exit case not found');
  return { success: true };
}

/* ─── Settings ─── */
async function getSettings() {
  let row = await HrSettings.findOne({ key: 'default' }).lean();
  if (!row) {
    const created = await HrSettings.create({ key: 'default' });
    row = created.toObject();
  }
  return row;
}

async function updateSettings(body) {
  const allowed = [
    'companyName',
    'workingDays',
    'weekend',
    'officeStart',
    'officeEnd',
    'lateAfterMinutes',
    'halfDayHours',
    'casualLeavePerYear',
    'sickLeavePerYear',
    'earnedLeavePerYear',
    'pfEnabled',
    'esicEnabled',
    'pfPercent',
    'emailNotifications',
    'birthdayReminders',
    'documentExpiryReminders',
  ];
  const $set = {};
  allowed.forEach((k) => {
    if (body[k] !== undefined) $set[k] = body[k];
  });
  const row = await HrSettings.findOneAndUpdate(
    { key: 'default' },
    { $set },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return row;
}

/* ─── Reports ─── */
async function getReportsSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    totalEmployees,
    activeEmployees,
    onNotice,
    terminated,
    pendingLeaves,
    approvedLeavesMonth,
    presentToday,
    expensePending,
    expenseApproved,
    openJobs,
    hiredThisMonth,
    assetsAssigned,
    exitsOpen,
    trainingCompleted,
    payrollLatest,
    deptDist,
    funnel,
  ] = await Promise.all([
    HrEmployee.countDocuments({ isDeleted: { $ne: true } }),
    HrEmployee.countDocuments({ isDeleted: { $ne: true }, status: 'active' }),
    HrEmployee.countDocuments({ isDeleted: { $ne: true }, status: 'on_notice' }),
    HrEmployee.countDocuments({ isDeleted: { $ne: true }, status: 'terminated' }),
    HrLeaveRequest.countDocuments({ isDeleted: { $ne: true }, status: 'pending' }),
    HrLeaveRequest.countDocuments({
      isDeleted: { $ne: true },
      status: 'approved',
      createdAt: { $gte: monthStart },
    }),
    Attendance.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['present', 'late'] },
    }),
    HrExpense.countDocuments({ isDeleted: { $ne: true }, status: 'pending' }),
    HrExpense.aggregate([
      { $match: { isDeleted: { $ne: true }, status: { $in: ['approved', 'reimbursed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    require('../models/hr/HrJobOpening').countDocuments({ isDeleted: { $ne: true }, status: 'open' }),
    HrCandidate.countDocuments({
      isDeleted: { $ne: true },
      stage: 'hired',
      updatedAt: { $gte: monthStart },
    }),
    HrAsset.countDocuments({ isDeleted: { $ne: true }, status: 'assigned' }),
    HrExitCase.countDocuments({
      isDeleted: { $ne: true },
      status: { $nin: ['completed', 'withdrawn'] },
    }),
    HrTrainingEnrollment.countDocuments({ isDeleted: { $ne: true }, status: 'completed' }),
    HrPayrollRun.findOne({ isDeleted: { $ne: true } }).sort({ year: -1, month: -1 }).lean(),
    HrEmployee.aggregate([
      { $match: { isDeleted: { $ne: true }, status: 'active' } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]),
    recruitmentFunnel(),
  ]);

  const deptIds = deptDist.map((d) => d._id).filter(Boolean);
  const depts = await HrDepartment.find({ _id: { $in: deptIds } }).select('name').lean();
  const deptMap = Object.fromEntries(depts.map((d) => [String(d._id), d.name]));

  const attritionRate =
    totalEmployees > 0 ? Math.round((terminated / totalEmployees) * 1000) / 10 : 0;

  return {
    attendance: {
      presentToday,
      activeEmployees,
      attendancePct: activeEmployees
        ? Math.round((presentToday / activeEmployees) * 1000) / 10
        : 0,
    },
    workforce: {
      totalEmployees,
      activeEmployees,
      onNotice,
      terminated,
      attritionRate,
    },
    leaves: {
      pending: pendingLeaves,
      approvedThisMonth: approvedLeavesMonth,
    },
    salary: {
      latestMonth: payrollLatest ? `${payrollLatest.month}/${payrollLatest.year}` : null,
      latestNet: payrollLatest?.totals?.net || 0,
      latestGross: payrollLatest?.totals?.gross || 0,
      headcount: payrollLatest?.totals?.employees || 0,
    },
    expenses: {
      pending: expensePending,
      approvedTotal: expenseApproved[0]?.total || 0,
    },
    hiring: {
      openJobs,
      hiredThisMonth,
      funnel,
    },
    assets: { assigned: assetsAssigned },
    exits: { open: exitsOpen },
    training: { completed: trainingCompleted },
    departments: deptDist.map((d) => ({
      name: d._id ? deptMap[String(d._id)] || 'Unassigned' : 'Unassigned',
      value: d.count,
    })),
  };
}

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listCourses,
  createCourse,
  deleteCourse,
  listEnrollments,
  enrollEmployee,
  updateEnrollment,
  listExits,
  createExit,
  updateExit,
  deleteExit,
  getSettings,
  updateSettings,
  getReportsSummary,
};
