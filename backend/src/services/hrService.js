const HrEmployee = require('../models/hr/HrEmployee');
const HrDepartment = require('../models/hr/HrDepartment');
const HrDesignation = require('../models/hr/HrDesignation');
const HrLeaveRequest = require('../models/hr/HrLeaveRequest');
const HrHoliday = require('../models/hr/HrHoliday');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/apiError');
const { startOfDay, endOfDay } = require('../utils/queryHelpers');
const { countPendingPayroll } = require('./hrPhase2Service');
const { countUpcomingInterviews } = require('./hrTalentService');

const EMP_POPULATE = [
  { path: 'departmentId', select: 'name code' },
  { path: 'designationId', select: 'name code' },
  { path: 'reportingManagerId', select: 'firstName lastName employeeCode' },
  { path: 'branchId', select: 'name code' },
];

function employeeFilter(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.designationId) filter.designationId = query.designationId;
  if (query.branchId) filter.branchId = query.branchId;
  if (query.employmentType) filter.employmentType = query.employmentType;
  if (query.gender) filter.gender = query.gender;
  if (query.search) {
    const q = String(query.search).trim();
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { employeeCode: { $regex: q, $options: 'i' } },
    ];
  }
  return filter;
}

async function listEmployees(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));
  const filter = employeeFilter(query);
  const [rows, total] = await Promise.all([
    HrEmployee.find(filter)
      .populate(EMP_POPULATE)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: true }),
    HrEmployee.countDocuments(filter),
  ]);
  return { rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function getEmployee(id) {
  const emp = await HrEmployee.findOne({ _id: id, isDeleted: { $ne: true } })
    .populate(EMP_POPULATE)
    .lean({ virtuals: true });
  if (!emp) throw new ApiError(404, 'Employee not found');
  return emp;
}

async function createEmployee(body, actor) {
  if (!body?.firstName?.trim()) throw new ApiError(400, 'First name is required');
  const emp = await HrEmployee.create({
    ...body,
    firstName: body.firstName.trim(),
    lastName: (body.lastName || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
    phone: (body.phone || '').trim(),
    createdBy: actor?._id || null,
  });
  return getEmployee(emp._id);
}

async function updateEmployee(id, body) {
  const emp = await HrEmployee.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!emp) throw new ApiError(404, 'Employee not found');
  const allowed = [
    'firstName', 'lastName', 'email', 'phone', 'alternatePhone', 'gender', 'dateOfBirth',
    'joiningDate', 'departmentId', 'designationId', 'reportingManagerId', 'employmentType',
    'status', 'shift', 'workLocation', 'salary', 'photoUrl', 'address', 'emergencyContact',
    'bank', 'notes', 'branchId', 'userId',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) emp[key] = body[key];
  }
  await emp.save();
  return getEmployee(emp._id);
}

async function deleteEmployee(id) {
  const emp = await HrEmployee.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!emp) throw new ApiError(404, 'Employee not found');
  emp.isDeleted = true;
  emp.status = 'inactive';
  await emp.save();
  return { success: true };
}

async function listDepartments() {
  return HrDepartment.find({ isDeleted: { $ne: true } }).sort({ name: 1 }).lean();
}

async function createDepartment(body) {
  if (!body?.name?.trim()) throw new ApiError(400, 'Department name is required');
  return HrDepartment.create({
    name: body.name.trim(),
    code: body.code || '',
    description: body.description || '',
    branchId: body.branchId || null,
    status: body.status || 'active',
  });
}

async function updateDepartment(id, body) {
  const row = await HrDepartment.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Department not found');
  ['name', 'code', 'description', 'branchId', 'status', 'headId'].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  await row.save();
  return row;
}

async function deleteDepartment(id) {
  const row = await HrDepartment.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Department not found');
  row.isDeleted = true;
  row.status = 'inactive';
  await row.save();
  return { success: true };
}

async function listDesignations(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.departmentId) filter.departmentId = query.departmentId;
  return HrDesignation.find(filter).populate('departmentId', 'name').sort({ name: 1 }).lean();
}

async function createDesignation(body) {
  if (!body?.name?.trim()) throw new ApiError(400, 'Designation name is required');
  return HrDesignation.create({
    name: body.name.trim(),
    code: body.code || '',
    level: Number(body.level) || 1,
    departmentId: body.departmentId || null,
    description: body.description || '',
    status: body.status || 'active',
  });
}

async function updateDesignation(id, body) {
  const row = await HrDesignation.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Designation not found');
  ['name', 'code', 'level', 'departmentId', 'description', 'status'].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  await row.save();
  return row;
}

async function deleteDesignation(id) {
  const row = await HrDesignation.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Designation not found');
  row.isDeleted = true;
  row.status = 'inactive';
  await row.save();
  return { success: true };
}

async function listHolidays(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.year) {
    const y = Number(query.year);
    filter.date = { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31, 23, 59, 59) };
  }
  return HrHoliday.find(filter).sort({ date: 1 }).lean();
}

async function createHoliday(body) {
  if (!body?.name?.trim() || !body?.date) throw new ApiError(400, 'Name and date are required');
  return HrHoliday.create({
    name: body.name.trim(),
    date: new Date(body.date),
    type: body.type || 'company',
    description: body.description || '',
    branchId: body.branchId || null,
    isOptional: Boolean(body.isOptional),
  });
}

async function deleteHoliday(id) {
  const row = await HrHoliday.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Holiday not found');
  row.isDeleted = true;
  await row.save();
  return { success: true };
}

async function listLeaves(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.leaveType) filter.leaveType = query.leaveType;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const [rows, total] = await Promise.all([
    HrLeaveRequest.find(filter)
      .populate({ path: 'employeeId', select: 'firstName lastName employeeCode photoUrl departmentId designationId' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    HrLeaveRequest.countDocuments(filter),
  ]);
  return { rows, total, page, limit };
}

async function createLeave(body) {
  if (!body?.employeeId || !body?.fromDate || !body?.toDate || !body?.leaveType) {
    throw new ApiError(400, 'Employee, leave type, and dates are required');
  }
  const from = new Date(body.fromDate);
  const to = new Date(body.toDate);
  const days = Math.max(1, Math.ceil((to - from) / (24 * 60 * 60 * 1000)) + 1);
  return HrLeaveRequest.create({
    employeeId: body.employeeId,
    leaveType: body.leaveType,
    fromDate: from,
    toDate: to,
    days,
    reason: body.reason || '',
    status: 'pending',
  });
}

async function reviewLeave(id, { status, comments }, actor) {
  if (!['approved', 'rejected', 'manager_approved'].includes(status)) {
    throw new ApiError(400, 'Invalid leave status');
  }
  const row = await HrLeaveRequest.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Leave request not found');
  row.status = status;
  row.comments = comments || '';
  row.reviewedBy = actor?._id || null;
  row.reviewedAt = new Date();
  await row.save();
  return row;
}

async function getHrDashboard() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const monthStart = startOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), 1));

  const [
    totalEmployees,
    activeEmployees,
    newJoinings,
    pendingLeaves,
    todayLeaves,
    holidaysUpcoming,
    deptDist,
    attendanceToday,
  ] = await Promise.all([
    HrEmployee.countDocuments({ isDeleted: { $ne: true } }),
    HrEmployee.countDocuments({ isDeleted: { $ne: true }, status: 'active' }),
    HrEmployee.countDocuments({
      isDeleted: { $ne: true },
      joiningDate: { $gte: monthStart, $lte: todayEnd },
    }),
    HrLeaveRequest.countDocuments({ isDeleted: { $ne: true }, status: 'pending' }),
    HrLeaveRequest.countDocuments({
      isDeleted: { $ne: true },
      status: { $in: ['approved', 'manager_approved'] },
      fromDate: { $lte: todayEnd },
      toDate: { $gte: todayStart },
    }),
    HrHoliday.find({
      isDeleted: { $ne: true },
      date: { $gte: todayStart },
    })
      .sort({ date: 1 })
      .limit(5)
      .lean(),
    HrEmployee.aggregate([
      { $match: { isDeleted: { $ne: true }, status: 'active' } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]),
    Attendance.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['present', 'late'] },
    }),
  ]);

  const birthdays = await HrEmployee.find({
    isDeleted: { $ne: true },
    status: 'active',
    dateOfBirth: { $ne: null },
  })
    .select('firstName lastName employeeCode dateOfBirth photoUrl departmentId')
    .populate('departmentId', 'name')
    .lean({ virtuals: true });

  const todayBirthdays = birthdays.filter((e) => {
    if (!e.dateOfBirth) return false;
    const d = new Date(e.dateOfBirth);
    return d.getDate() === todayStart.getDate() && d.getMonth() === todayStart.getMonth();
  });

  const anniversaries = await HrEmployee.find({
    isDeleted: { $ne: true },
    status: 'active',
    joiningDate: { $ne: null },
  })
    .select('firstName lastName employeeCode joiningDate photoUrl departmentId')
    .populate('departmentId', 'name')
    .lean({ virtuals: true });

  const todayAnniversaries = anniversaries.filter((e) => {
    if (!e.joiningDate) return false;
    const d = new Date(e.joiningDate);
    return d.getDate() === todayStart.getDate() && d.getMonth() === todayStart.getMonth();
  });

  const deptIds = deptDist.map((d) => d._id).filter(Boolean);
  const depts = await HrDepartment.find({ _id: { $in: deptIds } }).select('name').lean();
  const deptMap = Object.fromEntries(depts.map((d) => [String(d._id), d.name]));

  const presentToday = Number(attendanceToday) || 0;
  const attendancePct = activeEmployees
    ? Math.round((presentToday / activeEmployees) * 1000) / 10
    : 0;
  const payrollPending = await countPendingPayroll();
  const upcomingInterviews = await countUpcomingInterviews();

  return {
    kpis: {
      totalEmployees,
      activeEmployees,
      presentToday,
      absent: Math.max(0, activeEmployees - presentToday - todayLeaves),
      onLeave: todayLeaves,
      lateArrivals: 0,
      newJoinings,
      birthdays: todayBirthdays.length,
      workAnniversaries: todayAnniversaries.length,
      pendingLeaves,
      upcomingInterviews,
      payrollPending,
      attendancePct,
      averageAttendance: attendancePct,
      attritionRate: 0,
      monthlyHiring: newJoinings,
    },
    departmentDistribution: deptDist.map((d) => ({
      name: d._id ? deptMap[String(d._id)] || 'Unassigned' : 'Unassigned',
      value: d.count,
    })),
    todayBirthdays: todayBirthdays.slice(0, 8),
    todayAnniversaries: todayAnniversaries.slice(0, 8),
    upcomingHolidays: holidaysUpcoming,
    pendingLeaveRequests: await HrLeaveRequest.find({
      isDeleted: { $ne: true },
      status: 'pending',
    })
      .populate({ path: 'employeeId', select: 'firstName lastName employeeCode' })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
  };
}

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  listHolidays,
  createHoliday,
  deleteHoliday,
  listLeaves,
  createLeave,
  reviewLeave,
  getHrDashboard,
};
