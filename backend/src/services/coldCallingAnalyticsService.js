const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const CallNote = require('../models/CallNote');
const ColdCallingAssignment = require('../models/ColdCallingAssignment');
const ApiError = require('../utils/apiError');
const { getConfig } = require('./leadStatusConfigService');
const { buildBucketExpression } = require('../utils/listStatusBucketFilter');
const { bucketSwitchStage } = require('./callReportService');
const { bucketOutcome } = require('../models/CallNote');
const { ORG_TZ } = require('../utils/orgTimezone');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const {
  parseExecutiveLeadStatusQuery,
  buildAssignedMatch,
  bucketStage,
  parseObjectId,
} = require('./executiveLeadStatusService');

/**
 * Cold Calling analytics (Admin). Every figure is derived from existing records — nothing is stored
 * or counted separately:
 *
 *   ColdCallingAssignment  the cohort: one row per lead sent to Cold Calling (all statuses, so history is kept)
 *   CallNote               calls (callerRole 'cold_calling', by the assignment's agent, on the assigned lead)
 *   LeadStatusMovement     historical Cold -> Warm / Hot movements
 *   Lead                   the CURRENT status (bucket / converted / lost) and the current Sales owner
 *
 * PERIOD: the day the lead was assigned to Cold Calling (ColdCallingAssignment.assignedAt), as calendar
 * days in the org timezone — same date conventions as Executive Lead Status. The cohort is then followed
 * forward: calls, movements and current status are all "what happened to the leads assigned in this
 * period". Branch scope is the server-resolved req.branchId, never a client value.
 *
 * Ownership is never involved in attribution: a call belongs to CallNote.userId (the agent), the Sales
 * owner is only shown as context (original = assignment snapshot, current = Lead.assignedTo).
 */

/**
 * "Cold -> Warm" / "Cold -> Hot" = the assigned lead REACHED that bucket at some point after assignment,
 * read from the movement ledger (toBucket). A lead that went Cold -> Warm -> Hot counts in both — it did
 * move Cold -> Warm and it did reach Hot — and a lead that later fell back is still counted (history, not
 * current state).
 */
const REACHED_BUCKETS = ['warm', 'hot'];
const LOST_STATUSES = ['lost', 'booked_from_another_company'];
const CATEGORIES = ['cold', 'warm', 'hot', 'converted', 'lost', 'unclassified'];
const RECENT_CALLS = 10;
const LEADS_PAGE = { defaultLimit: 25, maxLimit: 100 };

const countWhen = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const round1 = (value) => Math.round(value * 10) / 10;

/* ------------------------------------------------------------------------------------------------ */
/* Query parsing                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

/** period / source / branch come from the Executive Lead Status parser so both reports agree; agent is extra. */
function parseColdCallingAnalyticsQuery(query = {}, branchId = null, { agentId } = {}) {
  const base = parseExecutiveLeadStatusQuery({ ...query, executiveId: undefined }, branchId);
  const agent = parseObjectId(agentId !== undefined ? agentId : query.agentId, 'agent');
  return { ...base, agentId: agent };
}

function parseColdCallingAgentLeadsQuery(query = {}, agentId, branchId = null) {
  const base = parseColdCallingAnalyticsQuery(query, branchId, { agentId });
  if (!base.agentId) throw new ApiError(400, 'agent is invalid');

  let category = null;
  if (query.category !== undefined && query.category !== null && query.category !== '') {
    if (typeof query.category !== 'string' || !CATEGORIES.includes(query.category)) throw new ApiError(400, 'category is invalid');
    category = query.category;
  }
  let activity = null;
  if (query.activity !== undefined && query.activity !== null && query.activity !== '') {
    if (!['worked', 'unworked'].includes(query.activity)) throw new ApiError(400, 'activity is invalid');
    activity = query.activity;
  }
  return { ...base, category, activity, ...parsePagination(query, LEADS_PAGE) };
}

/* ------------------------------------------------------------------------------------------------ */
/* Pipeline building blocks                                                                         */
/* ------------------------------------------------------------------------------------------------ */

function assignmentMatch({ branchId, agentId, periodStart, periodEnd }) {
  return {
    ...(branchId ? { branchId } : {}),
    ...(agentId ? { coldCallerId: agentId } : {}),
    ...((periodStart || periodEnd)
      ? { assignedAt: { ...(periodStart ? { $gte: periodStart } : {}), ...(periodEnd ? { $lte: periodEnd } : {}) } }
      : {}),
  };
}

/**
 * PIPELINE SHAPE (measured, see the benchmark notes in the phase report): the three joins are plain
 * localField/foreignField lookups placed CONSECUTIVELY at the start of the pipeline. That shape uses the
 * _id / leadId indexes and stays eligible for MongoDB's fast $lookup execution; the same joins written as
 * $expr sub-pipelines, or interleaved after $unwind/$match/$project, were 10-25x slower on the same data.
 * Everything else (filters, status category, per-call arithmetic) runs on the joined documents afterwards.
 */
const LOOKUP_LEAD = { $lookup: { from: 'leads', localField: 'leadId', foreignField: '_id', as: 'lead' } };
const LOOKUP_CALLS = { $lookup: { from: 'callnotes', localField: 'leadId', foreignField: 'leadId', as: 'allCalls' } };
const LOOKUP_MOVES = { $lookup: { from: 'leadstatusmovements', localField: 'leadId', foreignField: 'leadId', as: 'allMoves' } };

/**
 * After the lead join: unwind, drop deleted leads, apply the Source filter, and keep only the few fields the
 * report needs (plus the joined call / movement arrays when present) so downstream documents stay small.
 * The filter is written against flat copies, not `lead.*` directly: a $match on the joined sub-document is
 * folded back into the $lookup and loses the fast path.
 */
const leadFilterStages = ({ source }) => [
  { $unwind: '$lead' },
  { $addFields: { _deleted: '$lead.isDeleted', _source: '$lead.source' } },
  { $match: { _deleted: { $ne: true }, ...(source ? { _source: source } : {}) } },
  {
    $project: {
      coldCallerId: 1, coldCallerName: 1, leadId: 1, assignedAt: 1, status: 1, originalSalesOwnerId: 1, originalSalesOwnerName: 1,
      allCalls: 1, allMoves: 1,
      'lead._id': 1, 'lead.leadId': 1, 'lead.name': 1, 'lead.status': 1, 'lead.statusReason': 1, 'lead.source': 1, 'lead.assignedTo': 1,
    },
  },
];

/**
 * Current status category — the existing Cold/Warm/Hot rule, plus the two terminal states the CRM
 * already has. Precedence: converted > lost > bucket (a lost lead keeps a Cold-list reason such as
 * "booked elsewhere", which would otherwise be counted as still Cold).
 */
const categoryStage = () => ({
  $addFields: {
    category: {
      $switch: {
        branches: [
          { case: { $eq: ['$lead.status', 'converted'] }, then: 'converted' },
          { case: { $in: ['$lead.status', LOST_STATUSES] }, then: 'lost' },
        ],
        default: { $ifNull: [buildBucketExpression({ status: '$lead.status', statusReason: '$lead.statusReason' }), 'unclassified'] },
      },
    },
  },
});

const sizeOf = (input, cond) => ({ $size: { $filter: { input, as: 'c', cond } } });

/**
 * This agent's calls on this lead, computed from the joined `allCalls`:
 *   - userId = the assignment's agent and callerRole = 'cold_calling' (the Sales owner's calls never count)
 *   - createdAt >= assignedAt (server time): calls made while the assignment was live
 * "Connected" = the existing OUTCOME_BUCKETS rule (bucketSwitchStage); connected duration follows the Call
 * Report's own average (connected calls with a recorded duration). The joined array is dropped immediately,
 * so later stages carry only small per-call summaries.
 */
const callComputeStages = () => [
  {
    $addFields: {
      myCalls: {
        $map: {
          input: {
            $filter: {
              input: '$allCalls',
              as: 'c',
              cond: {
                $and: [
                  { $eq: ['$$c.userId', '$coldCallerId'] },
                  { $eq: ['$$c.callerRole', 'cold_calling'] },
                  { $gte: ['$$c.createdAt', '$assignedAt'] },
                ],
              },
            },
          },
          as: 'c',
          in: {
            outcome: '$$c.outcome',
            duration: { $ifNull: ['$$c.duration', 0] },
            last: { $ifNull: ['$$c.startedAt', '$$c.createdAt'] },
            bucket: bucketSwitchStage('$$c.outcome'),
          },
        },
      },
    },
  },
  { $project: { allCalls: 0 } },
  {
    $addFields: {
      callCount: { $size: '$myCalls' },
      connectedCalls: sizeOf('$myCalls', { $eq: ['$$c.bucket', 'connected'] }),
      talkSec: { $sum: '$myCalls.duration' },
      connN: sizeOf('$myCalls', { $and: [{ $eq: ['$$c.bucket', 'connected'] }, { $gt: ['$$c.duration', 0] }] }),
      connSec: {
        $sum: {
          $map: {
            input: { $filter: { input: '$myCalls', as: 'c', cond: { $and: [{ $eq: ['$$c.bucket', 'connected'] }, { $gt: ['$$c.duration', 0] }] } } },
            as: 'c',
            in: '$$c.duration',
          },
        },
      },
      lastCallAt: { $max: '$myCalls.last' },
    },
  },
];

/** Movements into Warm / Hot on this lead at/after it was assigned, from the joined `allMoves` (LeadStatusMovement). */
const movementComputeStages = () => {
  const reached = (bucket, byAgentOnly) => ({
    $gt: [
      {
        $size: {
          $filter: {
            input: '$moves',
            as: 'm',
            cond: { $and: [{ $eq: ['$$m.toBucket', bucket] }, ...(byAgentOnly ? [{ $eq: ['$$m.changedBy', '$coldCallerId'] }] : [])] },
          },
        },
      },
      0,
    ],
  });
  return [
    {
      $addFields: {
        moves: {
          $filter: {
            input: '$allMoves',
            as: 'm',
            cond: { $and: [{ $in: ['$$m.toBucket', REACHED_BUCKETS] }, { $gte: ['$$m.changedAt', '$assignedAt'] }] },
          },
        },
      },
    },
    { $project: { allMoves: 0 } },
    {
      $addFields: {
        movedWarm: reached('warm', false),
        movedHot: reached('hot', false),
        movedWarmByAgent: reached('warm', true),
        movedHotByAgent: reached('hot', true),
      },
    },
    { $project: { moves: 0 } },
  ];
};

/* ------------------------------------------------------------------------------------------------ */
/* Overview / agent metrics                                                                         */
/* ------------------------------------------------------------------------------------------------ */

/** The single cohort pipeline (exported for explain()/benchmarks). */
function cohortPipeline(params) {
  return [
      { $match: assignmentMatch(params) },
      LOOKUP_LEAD,
      LOOKUP_CALLS,
      LOOKUP_MOVES,
      ...leadFilterStages(params),
      categoryStage(),
      ...callComputeStages(),
      ...movementComputeStages(),
      {
        $facet: {
          agents: [
            {
              $group: {
                _id: '$coldCallerId',
                snapshotName: { $first: '$coldCallerName' },
                assigned: { $sum: 1 },
                worked: countWhen({ $gt: ['$callCount', 0] }),
                calls: { $sum: '$callCount' },
                connected: { $sum: '$connectedCalls' },
                talkSec: { $sum: '$talkSec' },
                connSec: { $sum: '$connSec' },
                connN: { $sum: '$connN' },
                ...Object.fromEntries(CATEGORIES.map((key) => [key, countWhen({ $eq: ['$category', key] })])),
                movedWarm: countWhen('$movedWarm'),
                movedHot: countWhen('$movedHot'),
                movedWarmByAgent: countWhen('$movedWarmByAgent'),
                movedHotByAgent: countWhen('$movedHotByAgent'),
              },
            },
          ],
          outcomes: [
            { $unwind: '$myCalls' },
            { $group: { _id: '$myCalls.outcome', bucket: { $first: '$myCalls.bucket' }, calls: { $sum: 1 } } },
          ],
        },
      },
  ];
}

/** ONE aggregation for the whole cohort: per-agent metrics and the outcome breakdown ($facet). */
async function aggregateCohort(params) {
  const [result] = await ColdCallingAssignment.aggregate(cohortPipeline(params), { allowDiskUse: true });
  return { agents: result?.agents || [], outcomes: result?.outcomes || [] };
}

/** "Cold leads in the Sales pool": same population and Cold rule as the Sales Executives tab, same filters. */
async function countColdPool(params) {
  const [row] = await Lead.aggregate([
    { $match: buildAssignedMatch({ ...params, executiveId: null }) },
    bucketStage(),
    { $match: { leadStatusBucket: 'cold' } },
    { $count: 'n' },
  ]);
  return row?.n || 0;
}

function toAgentRow(group, user) {
  const assigned = group?.assigned || 0;
  const worked = group?.worked || 0;
  const calls = group?.calls || 0;
  return {
    _id: user?._id || group?._id,
    // A removed user keeps the name recorded on the assignment, so historical rows never render blank.
    name: user?.name || group?.snapshotName || 'Unknown agent',
    email: user?.email || '',
    active: user ? user.status === 'active' : null,
    assigned,
    worked,
    unworked: assigned - worked,
    workRate: assigned ? round1((worked / assigned) * 100) : null,
    calls,
    connected: group?.connected || 0,
    talkTimeSec: group?.talkSec || 0,
    avgCallDurationSec: group?.connN ? Math.round(group.connSec / group.connN) : null,
    callsPerLead: worked ? round1(calls / worked) : null,
    coldToWarm: group?.movedWarm || 0,
    coldToHot: group?.movedHot || 0,
    coldToWarmByAgent: group?.movedWarmByAgent || 0,
    coldToHotByAgent: group?.movedHotByAgent || 0,
    converted: group?.converted || 0,
    status: Object.fromEntries(CATEGORIES.map((key) => [key, group?.[key] || 0])),
  };
}

function sumRows(rows) {
  const total = {
    assigned: 0, worked: 0, calls: 0, connected: 0, talkSec: 0, connSec: 0, connN: 0,
    movedWarm: 0, movedHot: 0, movedWarmByAgent: 0, movedHotByAgent: 0,
    ...Object.fromEntries(CATEGORIES.map((key) => [key, 0])),
  };
  for (const row of rows) {
    total.assigned += row.assigned;
    total.worked += row.worked;
    total.calls += row.calls;
    total.connected += row.connected;
    total.talkSec += row.talkTimeSec;
    total.connSec += row._connSec;
    total.connN += row._connN;
    total.movedWarm += row.coldToWarm;
    total.movedHot += row.coldToHot;
    total.movedWarmByAgent += row.coldToWarmByAgent;
    total.movedHotByAgent += row.coldToHotByAgent;
    for (const key of CATEGORIES) total[key] += row.status[key];
  }
  return total;
}

/** Summary / distribution / movements built from the per-agent groups (all arithmetic is server-side). */
function buildSections(groups, coldPool) {
  const rowsWithRaw = groups.map((group) => ({ ...toAgentRow(group), _connSec: group.connSec || 0, _connN: group.connN || 0 }));
  const total = sumRows(rowsWithRaw);
  const summary = {
    totalColdLeads: coldPool,
    assigned: total.assigned,
    worked: total.worked,
    unworked: total.assigned - total.worked,
    workRate: total.assigned ? round1((total.worked / total.assigned) * 100) : null,
    totalCalls: total.calls,
    connectedCalls: total.connected,
    avgCallDurationSec: total.connN ? Math.round(total.connSec / total.connN) : null,
    talkTimeSec: total.talkSec,
    callsPerLead: total.worked ? round1(total.calls / total.worked) : null,
  };
  // Percentages always have one stated denominator: the assigned leads in scope (null when there are none).
  const pct = (count) => (total.assigned ? round1((count / total.assigned) * 100) : null);
  const statusDistribution = CATEGORIES.map((key) => ({ key, count: total[key], percentOfAssigned: pct(total[key]) }));
  const statusMovements = [
    { key: 'cold_to_warm', leads: total.movedWarm, byAgent: total.movedWarmByAgent },
    { key: 'cold_to_hot', leads: total.movedHot, byAgent: total.movedHotByAgent },
    // Conversions are not in the movement ledger (it records Cold/Warm/Hot only): this is the cohort's current status.
    { key: 'cold_to_converted', leads: total.converted, byAgent: null },
    { key: 'still_cold', leads: total.cold, byAgent: null },
  ].map((row) => ({ ...row, percentOfAssigned: pct(row.leads) }));
  return { summary, statusDistribution, statusMovements };
}

const outcomeRows = (outcomes) =>
  outcomes
    .map((row) => ({ outcome: row._id, bucket: row.bucket || bucketOutcome(row._id), calls: row.calls }))
    .sort((a, b) => b.calls - a.calls || String(a.outcome).localeCompare(String(b.outcome)));

const responseMeta = (params) => ({
  period: {
    field: 'coldCallingAssignedAt',
    timezone: ORG_TZ,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  },
  filters: {
    branchId: params.branchId ? String(params.branchId) : null,
    agentId: params.agentId ? String(params.agentId) : null,
    source: params.source,
  },
});

async function getColdCallingAnalytics(params) {
  await getConfig({ includeDisabled: false });

  const rosterFilter = {
    role: 'cold_calling',
    status: 'active',
    ...(params.branchId ? { branchId: params.branchId } : {}),
    ...(params.agentId ? { _id: params.agentId } : {}),
  };
  const [cohort, coldPool, roster] = await Promise.all([
    aggregateCohort(params),
    countColdPool(params),
    User.find(rosterFilter).select('name email status').lean(),
  ]);

  // Agents who have assignments but are no longer in the active roster (disabled later) still get a row.
  const known = new Set(roster.map((user) => String(user._id)));
  const missingIds = cohort.agents.map((group) => group._id).filter((id) => !known.has(String(id)));
  const extra = missingIds.length ? await User.find({ _id: { $in: missingIds } }).select('name email status').lean() : [];
  const users = new Map([...roster, ...extra].map((user) => [String(user._id), user]));
  const groupsById = new Map(cohort.agents.map((group) => [String(group._id), group]));

  const allIds = [...new Set([...users.keys(), ...groupsById.keys()])];
  const agents = allIds
    .map((id) => toAgentRow(groupsById.get(id) || { _id: id }, users.get(id)))
    .sort((a, b) => b.assigned - a.assigned || String(a.name).localeCompare(String(b.name)));

  // Only groups that exist feed the totals (roster-only agents are zero rows).
  const sections = buildSections(cohort.agents, coldPool);
  return { ...responseMeta(params), ...sections, callOutcomes: outcomeRows(cohort.outcomes), agents };
}

/* ------------------------------------------------------------------------------------------------ */
/* Agent detail                                                                                     */
/* ------------------------------------------------------------------------------------------------ */

async function loadAgent(params) {
  const agent = await User.findOne({ _id: params.agentId, role: 'cold_calling' }).select('name email status branchId').lean();
  // Another branch's agent is indistinguishable from a missing one.
  if (!agent || (params.branchId && String(agent.branchId) !== String(params.branchId))) {
    throw new ApiError(404, 'Cold Calling agent not found');
  }
  return agent;
}

async function getColdCallingAgentDetail(params) {
  await getConfig({ includeDisabled: false });
  const agent = await loadAgent(params);

  const [cohort, recent] = await Promise.all([
    aggregateCohort(params),
    CallNote.find({ userId: agent._id, callerRole: 'cold_calling', ...(params.branchId ? { branchId: params.branchId } : {}) })
      .select('leadId outcome duration startedAt endedAt createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_CALLS)
      .populate('leadId', 'name')
      .lean(),
  ]);

  const sections = buildSections(cohort.agents, null);
  const { totalColdLeads, ...summary } = sections.summary;
  return {
    ...responseMeta(params),
    agent: { _id: agent._id, name: agent.name, email: agent.email, active: agent.status === 'active' },
    summary,
    statusDistribution: sections.statusDistribution,
    statusMovements: sections.statusMovements,
    callOutcomes: outcomeRows(cohort.outcomes),
    recentCalls: recent.map((call) => ({
      _id: call._id,
      lead: call.leadId ? { _id: call.leadId._id, name: call.leadId.name } : null,
      outcome: call.outcome,
      bucket: bucketOutcome(call.outcome),
      duration: call.duration || 0,
      startedAt: call.startedAt || call.createdAt,
    })),
  };
}

/**
 * The agent's leads, paginated. Without a Worked/Unworked filter the page is cut BEFORE the call and
 * movement lookups, so only `limit` leads ever pay for them; with the filter the calls must be known
 * first. No phone number is selected or returned (Admin opens Lead Detail for the existing masked view).
 */
async function getColdCallingAgentLeads(params) {
  await getConfig({ includeDisabled: false });
  const agent = await loadAgent(params);
  const callsFirst = Boolean(params.activity);

  // Page-only work: cheap because it runs on the <= limit rows that survive skip/limit.
  const enrich = [LOOKUP_CALLS, LOOKUP_MOVES, ...callComputeStages(), ...movementComputeStages()];
  const [result] = await ColdCallingAssignment.aggregate(
    [
      { $match: assignmentMatch(params) },
      LOOKUP_LEAD,
      ...(callsFirst ? [LOOKUP_CALLS] : []),
      ...leadFilterStages(params),
      categoryStage(),
      ...(params.category ? [{ $match: { category: params.category } }] : []),
      ...(callsFirst
        ? [...callComputeStages(), { $match: { callCount: params.activity === 'worked' ? { $gt: 0 } : 0 } }]
        : []),
      { $sort: { assignedAt: -1, _id: -1 } },
      {
        $facet: {
          rows: [
            { $skip: params.skip },
            { $limit: params.limit },
            ...(callsFirst ? [LOOKUP_MOVES, ...movementComputeStages()] : enrich),
            {
              $lookup: {
                from: 'users',
                let: { ownerRef: '$lead.assignedTo' },
                pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$ownerRef'] } } }, { $project: { name: 1 } }],
                as: 'currentOwner',
              },
            },
            {
              $project: {
                assignedAt: 1,
                status: 1,
                originalSalesOwnerId: 1,
                originalSalesOwnerName: 1,
                category: 1,
                callCount: 1,
                connectedCalls: 1,
                lastCallAt: 1,
                myCalls: { outcome: 1, last: 1 },
                movedWarm: 1,
                movedHot: 1,
                'lead._id': 1,
                'lead.leadId': 1,
                'lead.name': 1,
                'lead.status': 1,
                'lead.statusReason': 1,
                'lead.source': 1,
                currentOwner: { $arrayElemAt: ['$currentOwner', 0] },
              },
            },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ],
    { allowDiskUse: true }
  );

  const rows = (result?.rows || []).map((row) => {
    const lastOutcome = [...(row.myCalls || [])].sort((a, b) => new Date(b.last) - new Date(a.last))[0]?.outcome || '';
    return {
      assignmentId: row._id,
      assignmentStatus: row.status,
      assignedAt: row.assignedAt,
      lead: { _id: row.lead._id, leadId: row.lead.leadId, name: row.lead.name, source: row.lead.source || '' },
      category: row.category,
      status: row.lead.status,
      statusReason: row.lead.statusReason || '',
      originalSalesOwner: { _id: row.originalSalesOwnerId, name: row.originalSalesOwnerName || '' },
      currentSalesOwner: row.currentOwner ? { _id: row.currentOwner._id, name: row.currentOwner.name } : null,
      calls: { count: row.callCount || 0, connected: row.connectedCalls || 0, lastCallAt: row.lastCallAt || null, lastOutcome },
      movedToWarm: Boolean(row.movedWarm),
      movedToHot: Boolean(row.movedHot),
    };
  });

  return {
    agent: { _id: agent._id, name: agent.name },
    ...paginatedResponse(rows, { page: params.page, limit: params.limit, total: result?.total?.[0]?.n || 0 }),
    ...responseMeta(params),
    filters: { ...responseMeta(params).filters, category: params.category, activity: params.activity },
  };
}

module.exports = {
  cohortPipeline,
  CATEGORIES,
  parseColdCallingAnalyticsQuery,
  parseColdCallingAgentLeadsQuery,
  getColdCallingAnalytics,
  getColdCallingAgentDetail,
  getColdCallingAgentLeads,
};
