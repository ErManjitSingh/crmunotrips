const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Team = require('../models/Team');
const ApiError = require('../utils/apiError');
const { getExecutiveIdsForLeader } = require('./teamScopeService');

/** Roles that must check in daily (admin & sales_manager excluded). */
const CHECK_IN_ROLES = [
  'team_leader',
  'sales_executive',
  'accountant',
  'operations_manager',
];

const TRACKED_ROLES = [...CHECK_IN_ROLES];

const ORG_TZ = process.env.ATTENDANCE_TZ || 'Asia/Kolkata';
const LATE_HOUR = Number(process.env.ATTENDANCE_LATE_HOUR ?? 10);
const LATE_MINUTE = Number(process.env.ATTENDANCE_LATE_MINUTE ?? 15);

function calendarParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  return { y, m, d, key: `${y}-${m}-${d}` };
}

/** Start of calendar day in org timezone (stored as Date). */
function startOfCalendarDay(date = new Date()) {
  const { y, m, d } = calendarParts(date);
  return new Date(`${y}-${m}-${d}T00:00:00+05:30`);
}

function endOfCalendarDay(date = new Date()) {
  const { y, m, d } = calendarParts(date);
  return new Date(`${y}-${m}-${d}T23:59:59.999+05:30`);
}

function timePartsInOrg(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const minute = Number(parts.find((p) => p.type === 'minute').value);
  return { hour, minute };
}

function deriveStatus(checkIn) {
  const { hour, minute } = timePartsInOrg(checkIn);
  if (hour > LATE_HOUR || (hour === LATE_HOUR && minute > LATE_MINUTE)) {
    return 'late';
  }
  return 'present';
}

function computeTotalHours(checkIn, checkOut) {
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

function computeLateByMinutes(checkIn) {
  if (!checkIn) return null;
  const { hour, minute } = timePartsInOrg(checkIn);
  const checkMins = hour * 60 + minute;
  const expectedMins = LATE_HOUR * 60 + LATE_MINUTE;
  const diff = checkMins - expectedMins;
  return diff > 0 ? diff : 0;
}

function formatHoursLabel(totalHours, checkIn, checkOut) {
  if (totalHours != null && Number.isFinite(Number(totalHours))) {
    const h = Math.floor(Number(totalHours));
    const m = Math.round((Number(totalHours) - h) * 60);
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  }
  if (checkIn && !checkOut) {
    const ms = Date.now() - new Date(checkIn).getTime();
    if (ms < 0) return null;
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  }
  return null;
}

function expectedCheckInLabel() {
  const d = new Date();
  d.setHours(LATE_HOUR, LATE_MINUTE, 0, 0);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: ORG_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function formatRecord(doc, userMap) {
  const u = userMap?.get(doc.userId?.toString()) || doc.userId;
  const lateByMinutes = doc.status === 'late' ? computeLateByMinutes(doc.checkIn) : null;
  return {
    id: doc._id,
    userId: doc.userId?._id || doc.userId,
    userName: u?.name || 'Unknown',
    userEmail: u?.email,
    userRole: u?.role,
    department: u?.department || ROLE_LABEL_FALLBACK(u?.role),
    date: doc.date,
    checkIn: doc.checkIn,
    checkOut: doc.checkOut,
    totalHours: doc.totalHours,
    hoursLabel: formatHoursLabel(doc.totalHours, doc.checkIn, doc.checkOut),
    workMode: doc.workMode,
    status: doc.status,
    isAutoCheckout: doc.isAutoCheckout,
    isOnline: !doc.checkOut,
    lateByMinutes,
    expectedCheckIn: expectedCheckInLabel(),
    createdAt: doc.createdAt,
  };
}

function ROLE_LABEL_FALLBACK(role) {
  const map = {
    sales_executive: 'Sales',
    team_leader: 'Sales',
    sales_manager: 'Sales',
    operations_manager: 'Operations',
    accountant: 'Accounts',
    admin: 'Admin',
    lead_provider: 'Admin',
  };
  return map[role] || 'General';
}

async function buildUserMap(userIds) {
  const users = await User.find({ _id: { $in: userIds } })
    .select('name email role department')
    .lean();
  return new Map(users.map((u) => [u._id.toString(), u]));
}

async function getScopedUserIds(user, branchId = null) {
  if (user.role === 'admin' || user.role === 'lead_provider') {
    const users = await User.find({
      role: { $in: TRACKED_ROLES },
      status: 'active',
      ...(branchId ? { branchId } : {}),
    })
      .select('_id')
      .lean();
    return users.map((u) => u._id.toString());
  }

  if (user.role === 'sales_manager') {
    const teams = await Team.find({
      salesManager: user._id,
      ...(branchId ? { branchId } : {}),
    }).lean();
    const ids = new Set();
    for (const team of teams) {
      if (team.teamLeader) ids.add(team.teamLeader.toString());
      team.members?.forEach((m) => ids.add(m.toString()));
    }
    if (!ids.size) {
      const allTeams = await Team.find(branchId ? { branchId } : {}).lean();
      for (const team of allTeams) {
        if (team.teamLeader) ids.add(team.teamLeader.toString());
        team.members?.forEach((m) => ids.add(m.toString()));
      }
    }
    return [...ids].filter((id) => id !== user._id.toString());
  }

  if (user.role === 'team_leader') {
    const memberIds = await getExecutiveIdsForLeader(user._id);
    return [user._id.toString(), ...memberIds];
  }

  return [user._id.toString()];
}

async function getTodayStatus(userId) {
  const user = await User.findById(userId).select('role branchId').lean();
  const requiresCheckIn = CHECK_IN_ROLES.includes(user?.role);
  const dayStart = startOfCalendarDay();
  const record = await Attendance.findOne({
    userId,
    date: dayStart,
    ...(user?.branchId ? { branchId: user.branchId } : {}),
  }).lean();

  return {
    date: dayStart,
    requiresCheckIn,
    checkedIn: Boolean(record && !record.checkOut),
    checkedOut: Boolean(record?.checkOut),
    record: record ? formatRecord(record) : null,
    // After check-out, allow another check-in the same day so Check Out can appear again
    canCheckIn: requiresCheckIn && (!record || Boolean(record.checkOut)),
    canCheckOut: requiresCheckIn && Boolean(record && !record.checkOut),
  };
}

async function checkIn(userId, workMode = 'office') {
  if (workMode !== 'office') {
    throw new ApiError(400, 'workMode must be office');
  }

  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    throw new ApiError(400, 'User is not active');
  }
  if (!CHECK_IN_ROLES.includes(user.role)) {
    throw new ApiError(403, 'Attendance check-in is not required for your role');
  }

  const dayStart = startOfCalendarDay();
  const existing = await Attendance.findOne({ userId, date: dayStart });
  const now = new Date();

  // Same-day return after check-out: reopen attendance so Check Out is available again
  if (existing?.checkOut) {
    existing.checkIn = now;
    existing.checkOut = null;
    existing.totalHours = null;
    existing.workMode = workMode;
    existing.status = deriveStatus(now);
    existing.isAutoCheckout = false;
    await existing.save();
    return formatRecord(existing.toObject());
  }

  if (existing) {
    throw new ApiError(409, 'You have already checked in today');
  }

  const record = await Attendance.create({
    userId,
    branchId: user.branchId || null,
    date: dayStart,
    checkIn: now,
    workMode,
    status: deriveStatus(now),
    isAutoCheckout: false,
  });

  return formatRecord(record.toObject());
}

async function checkOut(userId) {
  const user = await User.findById(userId).select('role');
  if (!user || !CHECK_IN_ROLES.includes(user.role)) {
    throw new ApiError(403, 'Attendance check-out is not required for your role');
  }

  const dayStart = startOfCalendarDay();
  const record = await Attendance.findOne({ userId, date: dayStart });
  if (!record) throw new ApiError(400, 'No check-in found for today');
  if (record.checkOut) throw new ApiError(400, 'Already checked out for today');

  const now = new Date();
  record.checkOut = now;
  record.totalHours = computeTotalHours(record.checkIn, now);
  record.isAutoCheckout = false;
  await record.save();

  return formatRecord(record.toObject());
}

async function getMyHistory(userId, limit = 30) {
  const records = await Attendance.find({ userId })
    .sort({ date: -1 })
    .limit(limit)
    .lean();
  const userMap = await buildUserMap([userId]);
  return records.map((r) => formatRecord(r, userMap));
}

function isSameCalendarDay(a, b) {
  return calendarParts(a).key === calendarParts(b).key;
}

function parseDateInput(input) {
  if (!input) return new Date();
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T12:00:00+05:30`);
  }
  return new Date(input);
}

async function buildRangeSummary(viewer, branchId = null, fromInput = null, toInput = null) {
  const fromDate = startOfCalendarDay(parseDateInput(fromInput));
  const toDate = startOfCalendarDay(parseDateInput(toInput || fromInput));
  const rangeEnd = fromDate > toDate ? fromDate : toDate;
  const rangeStart = fromDate > toDate ? toDate : fromDate;
  const isSingleDay = isSameCalendarDay(rangeStart, rangeEnd);
  const isToday = isSingleDay && isSameCalendarDay(rangeStart, new Date());

  const scopedIds = await getScopedUserIds(viewer, branchId);
  const scopedObjectIds = scopedIds;

  const dateFilter = isSingleDay
    ? { date: rangeStart }
    : { date: { $gte: rangeStart, $lte: rangeEnd } };

  const [records, scopedUsers] = await Promise.all([
    Attendance.find({
      userId: { $in: scopedObjectIds },
      ...dateFilter,
      ...(branchId ? { branchId } : {}),
    })
      .sort({ date: -1, checkIn: -1 })
      .lean(),
    User.find({
      _id: { $in: scopedObjectIds },
      status: 'active',
      ...(branchId ? { branchId } : {}),
    })
      .select('name email role department')
      .lean(),
  ]);

  const userMap = new Map(scopedUsers.map((u) => [u._id.toString(), u]));
  const formatted = records.map((r) => formatRecord(r, userMap));

  const present = formatted.filter((r) => r.status === 'present').length;
  const late = formatted.filter((r) => r.status === 'late').length;
  const officeUsers = formatted.filter((r) => r.workMode === 'office' || r.workMode === 'wfh');
  const onlineUsers = isSingleDay && isToday ? formatted.filter((r) => r.isOnline) : [];
  const uniqueUsers = new Set(formatted.map((r) => r.userId?.toString())).size;

  let absentUsers = [];
  let officeRows = [];
  if (isSingleDay) {
    const checkedInIds = new Set(records.map((r) => r.userId.toString()));
    absentUsers = scopedUsers
      .filter((u) => !checkedInIds.has(u._id.toString()))
      .map((u) => ({
        id: `absent-${u._id}`,
        userId: u._id,
        userName: u.name,
        userEmail: u.email,
        userRole: u.role,
        department: u.department || ROLE_LABEL_FALLBACK(u.role),
        checkIn: null,
        checkOut: null,
        totalHours: null,
        hoursLabel: null,
        status: 'absent',
        isOnline: false,
        lateByMinutes: null,
        expectedCheckIn: expectedCheckInLabel(),
      }));

    officeRows = [
      ...officeUsers,
      ...absentUsers,
    ];
  }

  const myStatus = isToday ? await getTodayStatus(viewer._id) : null;
  const onLeaveToday = 0;

  const summary = {
    presentToday: present,
    absentToday: absentUsers.length,
    lateToday: late,
    onLeaveToday,
    officeCount: officeUsers.length,
    onlineCount: onlineUsers.length,
    totalScoped: scopedUsers.length,
    totalCheckIns: formatted.length,
    uniqueUsers,
    dayCount: isSingleDay
      ? 1
      : Math.round((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000)) + 1,
  };

  return {
    date: rangeStart,
    dateTo: rangeEnd,
    timezone: ORG_TZ,
    isSingleDay,
    isToday,
    summary,
    officeUsers: isSingleDay ? officeUsers : [],
    officeRows: isSingleDay ? officeRows : [],
    lateUsers: isSingleDay ? formatted.filter((r) => r.status === 'late') : [],
    onlineUsers,
    absentUsers,
    teamAttendance: formatted,
    myStatus,
  };
}

async function buildTodaySummary(viewer, branchId = null) {
  return buildRangeSummary(viewer, branchId);
}

module.exports = {
  CHECK_IN_ROLES,
  TRACKED_ROLES,
  checkIn,
  checkOut,
  getTodayStatus,
  getMyHistory,
  buildTodaySummary,
  buildRangeSummary,
  startOfCalendarDay,
  calendarParts,
};
