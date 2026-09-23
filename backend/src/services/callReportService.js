const mongoose = require('mongoose');
const CallNote = require('../models/CallNote');
const { OUTCOME_BUCKETS, bucketOutcome } = require('../models/CallNote');
const { startOfDay, endOfDay } = require('../utils/queryHelpers');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

function toIdString(value) {
  if (!value) return '';
  return String(value._id || value);
}

/** Aggregate $match does not auto-cast like Model.find() — branchId must be cast explicitly. */
function toObjectId(id) {
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(String(id)) ? new mongoose.Types.ObjectId(String(id)) : null;
}

/** Mongo $switch mirroring OUTCOME_BUCKETS so the pipeline can't drift from the JS mapping. */
function bucketSwitchStage(outcomeField = '$outcome') {
  const branches = Object.entries(OUTCOME_BUCKETS).map(([outcome, bucket]) => ({
    case: { $eq: [outcomeField, outcome] },
    then: bucket,
  }));
  return { $switch: { branches, default: 'failed' } };
}

/** Date-range filter defaults to "today" when nothing is supplied. */
function resolvePeriod(dateFrom, dateTo) {
  const now = new Date();
  const periodStart = dateFrom ? startOfDay(new Date(dateFrom)) : startOfDay(now);
  const periodEnd = dateTo ? endOfDay(new Date(dateTo)) : endOfDay(dateFrom ? new Date(dateFrom) : now);
  return { periodStart, periodEnd };
}

/** Fixed business rule: every Sales Executive has a 2h/day calling target — no configurable target system exists for this yet. */
const DAILY_CALL_TARGET_SEC = 2 * 60 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of calendar days spanned by [periodStart, periodEnd] (both inclusive) — Today/Yesterday
 * are always 1 day; a Custom Range is however many calendar days the manager picked. The talk-time
 * target is daily, so it scales with this count (e.g. a 3-day range needs 3 × 2h = 6h), matching
 * the report's own existing semantics of treating every calendar day in range equally (no
 * working-day/holiday exclusion exists anywhere else in Call Report today).
 */
function daysInPeriod(periodStart, periodEnd) {
  return Math.floor((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY) + 1;
}

const EFFECTIVE_START = { $ifNull: ['$startedAt', '$createdAt'] };
// Stored timestamps are UTC; bucket by hour/day in the org's local timezone so charts match
// what managers see elsewhere in the app (e.g. the timeline, which renders in browser-local time).
const ORG_TZ = process.env.ATTENDANCE_TZ || 'Asia/Kolkata';

function baseMatch({ userId, branchId, periodStart, periodEnd }) {
  const branchObjectId = toObjectId(branchId);
  return {
    ...(userId
      ? { userId: new mongoose.Types.ObjectId(String(userId)) }
      // Team-wide totals are Sales figures: Cold Calling agents' calls are theirs, not the sales team's.
      : { callerRole: { $ne: 'cold_calling' } }),
    ...(branchObjectId ? { branchId: branchObjectId } : {}),
    createdAt: { $gte: periodStart, $lte: periodEnd },
  };
}

/**
 * One CallNote doc -> one timeline item (presentation-only, no new data). A CallNote's `_id` is
 * the single reliable identifier tying its start and end together — they were never separate
 * records; the old timeline just rendered the same note twice (a synthetic "started" row and an
 * "ended" row) which read as two different calls. `outcome` is required at write time, so every
 * CallNote already represents a concluded call; `endedAt` is still surfaced as nullable so the
 * frontend can show "Incomplete" rather than fabricate an end time if it's ever genuinely absent.
 */
function normalizeCallEvent(note) {
  return {
    callId: note._id,
    leadId: note.leadId,
    leadName: note.leadName || 'Unknown guest',
    leadPhone: note.leadPhone || '',
    leadDestination: note.leadDestination || '',
    userId: note.userId,
    userName: note.userName || '',
    startedAt: note.startedAt || note.createdAt,
    endedAt: note.endedAt || null,
    duration: note.duration || 0,
    outcome: note.outcome,
    outcomeBucket: bucketOutcome(note.outcome),
    notes: note.notes || '',
  };
}

async function getExecutiveTimeline({ userId, branchId, dateFrom, dateTo, page, limit }) {
  const { periodStart, periodEnd } = resolvePeriod(dateFrom, dateTo);
  const match = baseMatch({ userId, branchId, periodStart, periodEnd });
  const { page: p, limit: l, skip } = parsePagination({ page, limit }, { defaultLimit: 20, maxLimit: 100 });

  const [notes, total] = await Promise.all([
    CallNote.aggregate([
      { $match: match },
      { $addFields: { effectiveStart: EFFECTIVE_START } },
      { $sort: { effectiveStart: 1, _id: 1 } },
      { $skip: skip },
      { $limit: l },
      { $lookup: { from: 'leads', localField: 'leadId', foreignField: '_id', as: 'lead' } },
      { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: {
        outcome: 1, notes: 1, duration: 1, startedAt: 1, endedAt: 1, createdAt: 1,
        leadId: 1, leadName: '$lead.name', leadPhone: '$lead.phone', leadDestination: '$lead.destination',
        userId: 1, userName: '$user.name',
      } },
    ]),
    CallNote.countDocuments(match),
  ]);

  const events = notes.map(normalizeCallEvent);
  return { events, pagination: paginatedResponse(null, { page: p, limit: l, total }).pagination };
}

async function getExecutiveSummary({ userId, branchId, dateFrom, dateTo }) {
  const { periodStart, periodEnd } = resolvePeriod(dateFrom, dateTo);
  const match = baseMatch({ userId, branchId, periodStart, periodEnd });

  const [result] = await CallNote.aggregate([
    { $match: match },
    { $addFields: { bucket: bucketSwitchStage() } },
    { $facet: {
      totals: [{ $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        connected: { $sum: { $cond: [{ $eq: ['$bucket', 'connected'] }, 1, 0] } },
        noAnswer: { $sum: { $cond: [{ $eq: ['$bucket', 'no_answer'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$bucket', 'failed'] }, 1, 0] } },
        totalTalkTime: { $sum: '$duration' },
        uniqueGuests: { $addToSet: '$leadId' },
      } }],
      connectedStats: [
        { $match: { bucket: 'connected', duration: { $gt: 0 } } },
        { $group: { _id: null, longest: { $max: '$duration' }, shortest: { $min: '$duration' }, sum: { $sum: '$duration' }, count: { $sum: 1 } } },
      ],
    } },
  ]);

  const t = result?.totals?.[0] || {};
  const c = result?.connectedStats?.[0] || {};
  const uniqueGuestsContacted = (t.uniqueGuests || []).length;
  const totalCalls = t.totalCalls || 0;
  const totalTalkTimeSec = t.totalTalkTime || 0;
  // Same daily calling target as Team Overview (2h × calendar days in the selected period) —
  // reused here so a single executive's summary (Admin/Sales Manager drill-down, or a Sales
  // Executive viewing their own report) shows the identical Target/Status the team table does.
  const targetTalkTimeSec = daysInPeriod(periodStart, periodEnd) * DAILY_CALL_TARGET_SEC;

  return {
    totalCalls,
    connectedCalls: t.connected || 0,
    noAnswerCalls: t.noAnswer || 0,
    failedCalls: t.failed || 0,
    totalTalkTimeSec,
    avgCallDurationSec: c.count ? Math.round(c.sum / c.count) : 0,
    longestCallSec: c.longest || 0,
    shortestCallSec: c.shortest || 0,
    uniqueGuestsContacted,
    avgCallsPerGuest: uniqueGuestsContacted ? Math.round((totalCalls / uniqueGuestsContacted) * 10) / 10 : 0,
    targetTalkTimeSec,
    targetMet: totalTalkTimeSec >= targetTalkTimeSec,
    connectionRate: totalCalls ? Math.round(((t.connected || 0) / totalCalls) * 1000) / 10 : 0,
  };
}

async function getTeamOverview(executives = [], { branchId, dateFrom, dateTo } = {}) {
  if (!executives.length) return [];
  const { periodStart, periodEnd } = resolvePeriod(dateFrom, dateTo);
  const targetTalkTimeSec = daysInPeriod(periodStart, periodEnd) * DAILY_CALL_TARGET_SEC;
  const idObjects = executives.map((ex) => new mongoose.Types.ObjectId(String(ex._id)));
  const branchObjectId = toObjectId(branchId);

  const rows = await CallNote.aggregate([
    { $match: { userId: { $in: idObjects }, ...(branchObjectId ? { branchId: branchObjectId } : {}), createdAt: { $gte: periodStart, $lte: periodEnd } } },
    { $addFields: { bucket: bucketSwitchStage() } },
    { $group: {
      _id: '$userId',
      totalCalls: { $sum: 1 },
      connected: { $sum: { $cond: [{ $eq: ['$bucket', 'connected'] }, 1, 0] } },
      noAnswer: { $sum: { $cond: [{ $eq: ['$bucket', 'no_answer'] }, 1, 0] } },
      totalTalkTime: { $sum: '$duration' },
      connectedDuration: { $sum: { $cond: [{ $eq: ['$bucket', 'connected'] }, '$duration', 0] } },
      uniqueGuests: { $addToSet: '$leadId' },
    } },
  ]);

  const map = Object.fromEntries(rows.map((r) => [toIdString(r._id), r]));
  return executives
    .map((ex) => {
      const key = toIdString(ex._id);
      const r = map[key] || { totalCalls: 0, connected: 0, noAnswer: 0, totalTalkTime: 0, connectedDuration: 0, uniqueGuests: [] };
      return {
        _id: ex._id,
        name: ex.name,
        email: ex.email,
        totalCalls: r.totalCalls,
        connectedCalls: r.connected,
        noAnswerCalls: r.noAnswer,
        totalTalkTimeSec: r.totalTalkTime,
        avgCallDurationSec: r.connected ? Math.round(r.connectedDuration / r.connected) : 0,
        uniqueGuestsContacted: (r.uniqueGuests || []).length,
        connectionRate: r.totalCalls ? Math.round((r.connected / r.totalCalls) * 1000) / 10 : 0,
        // Daily calling target (2h × number of calendar days in the selected period) — Status is
        // driven solely by accumulated talk time, never by call count/connection rate/avg duration.
        targetTalkTimeSec,
        targetMet: r.totalTalkTime >= targetTalkTimeSec,
      };
    })
    .sort(compareTeamOverviewRows);
}

/**
 * Ranks by productive calling performance, not raw call volume: an executive who dials more but
 * connects/talks less must not outrank one who hit the daily target with fewer, better calls.
 * Lexicographic — each key only breaks ties left by the one before it:
 *   1. Target Met before Not Met
 *   2. Talk Time (desc)
 *   3. Connected Calls (desc)
 *   4. Connection Rate (desc)
 *   5. Total Calls (desc)
 */
function compareTeamOverviewRows(a, b) {
  if (a.targetMet !== b.targetMet) return a.targetMet ? -1 : 1;
  if (b.totalTalkTimeSec !== a.totalTalkTimeSec) return b.totalTalkTimeSec - a.totalTalkTimeSec;
  if (b.connectedCalls !== a.connectedCalls) return b.connectedCalls - a.connectedCalls;
  if (b.connectionRate !== a.connectionRate) return b.connectionRate - a.connectionRate;
  return b.totalCalls - a.totalCalls;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HOUR_DETAIL_DEFAULT_LIMIT = 20;
const HOUR_DETAIL_MAX_LIMIT = 100;

/**
 * Filtered/paginated call list, shared by every Call Report drill-down that needs individual
 * CallNote rows: the Calls-by-Hour bucket (hover preview + click detail) and the per-executive
 * KPI drill-downs (Total Calls / Connected / No Answer / Failed / Talk Time / Longest / Shortest).
 * Same branchId/date/userId scoping as the rest of Call Report. `hour` narrows to one hour-of-day
 * bucket (on the same effectiveStart/ORG_TZ basis the byHour chart is grouped by) when supplied;
 * omitting it returns the whole date range. `durationGt` and `sortBy`/`sortDir` let a caller ask
 * for the exact same population/ordering a KPI's own backend calculation already used (e.g. the
 * connected-and-duration>0 set behind avgCallDurationSec), so a drill-down can never disagree with
 * the KPI it explains. `includeGuestBreakdown` adds a per-guest call-count facet computed from the
 * same matched set, for the Unique Guests / Avg Calls-per-Guest KPIs.
 */
async function getHourlyCallDetail({
  userId, branchId, dateFrom, dateTo, hour, outcome, durationGt, sortBy, sortDir, search, page, limit,
  includeGuestBreakdown,
}) {
  const { periodStart, periodEnd } = resolvePeriod(dateFrom, dateTo);
  const match = baseMatch({ userId, branchId, periodStart, periodEnd });
  if (Number.isInteger(hour)) {
    match.$expr = { $eq: [{ $hour: { date: EFFECTIVE_START, timezone: ORG_TZ } }, hour] };
  }
  if (Number.isFinite(durationGt)) {
    match.duration = { $gt: durationGt };
  }
  const { page: p, limit: l, skip } = parsePagination(
    { page, limit },
    { defaultLimit: HOUR_DETAIL_DEFAULT_LIMIT, maxLimit: HOUR_DETAIL_MAX_LIMIT }
  );

  const pipeline = [
    { $match: match },
    { $addFields: { bucket: bucketSwitchStage(), effectiveStart: EFFECTIVE_START } },
  ];
  if (['connected', 'no_answer', 'failed'].includes(outcome)) {
    pipeline.push({ $match: { bucket: outcome } });
  }
  pipeline.push(
    { $lookup: { from: 'leads', localField: 'leadId', foreignField: '_id', as: 'lead' } },
    { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  );
  const trimmedSearch = (search || '').trim();
  if (trimmedSearch) {
    const rx = new RegExp(escapeRegex(trimmedSearch), 'i');
    pipeline.push({ $match: { $or: [{ 'lead.name': rx }, { 'lead.phone': rx }] } });
  }

  const rowSort = sortBy === 'duration' ? { duration: sortDir === 'asc' ? 1 : -1, _id: 1 } : { effectiveStart: 1, _id: 1 };
  pipeline.push({
    $facet: {
      rows: [
        { $sort: rowSort },
        { $skip: skip },
        { $limit: l },
        { $project: {
          leadId: 1, leadName: '$lead.name', leadPhone: '$lead.phone',
          userId: 1, userName: '$user.name',
          startedAt: 1, endedAt: 1, createdAt: 1, duration: 1,
          outcome: 1, bucket: 1, notes: 1,
        } },
      ],
      totalCount: [{ $count: 'count' }],
      summary: [{ $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        connected: { $sum: { $cond: [{ $eq: ['$bucket', 'connected'] }, 1, 0] } },
        noAnswer: { $sum: { $cond: [{ $eq: ['$bucket', 'no_answer'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$bucket', 'failed'] }, 1, 0] } },
        totalTalkTime: { $sum: '$duration' },
        executives: { $addToSet: '$userId' },
      } }],
      ...(includeGuestBreakdown ? {
        guestBreakdown: [
          { $group: {
            _id: '$leadId',
            leadName: { $first: '$lead.name' },
            leadPhone: { $first: '$lead.phone' },
            calls: { $sum: 1 },
          } },
          { $sort: { calls: -1 } },
        ],
      } : {}),
    },
  });

  const [result] = await CallNote.aggregate(pipeline);
  const total = result?.totalCount?.[0]?.count || 0;
  const s = result?.summary?.[0] || {};

  return {
    hour: Number.isInteger(hour) ? hour : null,
    calls: (result?.rows || []).map((r) => ({
      callId: r._id,
      leadId: r.leadId,
      leadName: r.leadName || 'Unknown guest',
      leadPhone: r.leadPhone || '',
      userId: r.userId,
      userName: r.userName || 'Unknown executive',
      startedAt: r.startedAt || r.createdAt,
      endedAt: r.endedAt || null,
      duration: r.duration || 0,
      outcome: r.outcome,
      outcomeBucket: r.bucket,
      notes: r.notes || '',
    })),
    pagination: paginatedResponse(null, { page: p, limit: l, total }).pagination,
    summary: {
      totalCalls: s.totalCalls || 0,
      connectedCalls: s.connected || 0,
      noAnswerCalls: s.noAnswer || 0,
      failedCalls: s.failed || 0,
      totalTalkTimeSec: s.totalTalkTime || 0,
      activeExecutives: (s.executives || []).length,
    },
    ...(includeGuestBreakdown ? {
      guestBreakdown: (result?.guestBreakdown || []).map((g) => ({
        leadId: g._id,
        leadName: g.leadName || 'Unknown guest',
        leadPhone: g.leadPhone || '',
        calls: g.calls,
      })),
    } : {}),
  };
}

async function getAnalytics({ userId, branchId, dateFrom, dateTo }) {
  const { periodStart, periodEnd } = resolvePeriod(dateFrom, dateTo);
  const match = baseMatch({ userId, branchId, periodStart, periodEnd });

  const [result] = await CallNote.aggregate([
    { $match: match },
    { $addFields: { bucket: bucketSwitchStage(), effectiveStart: EFFECTIVE_START } },
    { $facet: {
      byHour: [
        { $group: { _id: { $hour: { date: '$effectiveStart', timezone: ORG_TZ } }, count: { $sum: 1 }, talkTime: { $sum: '$duration' } } },
        { $sort: { _id: 1 } },
      ],
      byDay: [
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveStart', timezone: ORG_TZ } },
          calls: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ['$bucket', 'connected'] }, 1, 0] } },
          talkTime: { $sum: '$duration' },
        } },
        { $sort: { _id: 1 } },
      ],
      byExecutive: [
        { $group: {
          _id: '$userId',
          calls: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ['$bucket', 'connected'] }, 1, 0] } },
          talkTime: { $sum: '$duration' },
          uniqueGuests: { $addToSet: '$leadId' },
        } },
      ],
      guestAttempts: [
        { $group: { _id: '$leadId', attempts: { $sum: 1 } } },
        { $group: { _id: null, totalGuests: { $sum: 1 }, totalAttempts: { $sum: '$attempts' } } },
      ],
      overallTotals: [
        { $group: { _id: null, totalCalls: { $sum: 1 }, connected: { $sum: { $cond: [{ $eq: ['$bucket', 'connected'] }, 1, 0] } } } },
      ],
    } },
  ]);

  const byExecutiveRaw = result?.byExecutive || [];
  let executiveNames = {};
  if (byExecutiveRaw.length) {
    const User = require('../models/User');
    const ids = byExecutiveRaw.map((r) => r._id).filter(Boolean);
    const users = await User.find({ _id: { $in: ids } }).select('name').lean();
    executiveNames = Object.fromEntries(users.map((u) => [toIdString(u._id), u.name]));
  }

  const guestAttempts = result?.guestAttempts?.[0] || { totalGuests: 0, totalAttempts: 0 };
  const overall = result?.overallTotals?.[0] || { totalCalls: 0, connected: 0 };

  return {
    byHour: result?.byHour || [],
    byDay: result?.byDay || [],
    byExecutive: byExecutiveRaw
      .map((r) => ({
        userId: r._id,
        name: executiveNames[toIdString(r._id)] || 'Unknown',
        calls: r.calls,
        connected: r.connected,
        talkTime: r.talkTime,
        uniqueGuestsContacted: (r.uniqueGuests || []).length,
      }))
      // $group does not guarantee order — sort explicitly so "highest caller first" never depends on Mongo internals.
      .sort((a, b) => b.calls - a.calls),
    avgAttemptsPerGuest: guestAttempts.totalGuests
      ? Math.round((guestAttempts.totalAttempts / guestAttempts.totalGuests) * 10) / 10
      : 0,
    connectionRateOverall: overall.totalCalls ? Math.round((overall.connected / overall.totalCalls) * 1000) / 10 : 0,
    totalCalls: overall.totalCalls,
  };
}

module.exports = {
  bucketSwitchStage,
  getExecutiveTimeline,
  getExecutiveSummary,
  getTeamOverview,
  getAnalytics,
  getHourlyCallDetail,
};
