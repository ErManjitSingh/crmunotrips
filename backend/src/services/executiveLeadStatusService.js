const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const ColdCallingAssignment = require('../models/ColdCallingAssignment');
const ApiError = require('../utils/apiError');
const { getConfig } = require('./leadStatusConfigService');
const { buildBucketExpression } = require('../utils/listStatusBucketFilter');
const { ORG_TZ, startOfCalendarDay, endOfCalendarDay } = require('../utils/orgTimezone');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { applyPhoneVisibilityGate } = require('../utils/leadPhoneVisibility');

/**
 * Executive Lead Status report (Admin).
 *
 * Population ("Assigned"): non-deleted leads whose CURRENT `assignedTo` is a Sales Executive and
 * whose `assignedAt` falls in the selected period. Deliberately no assignment-history
 * reconstruction (V1) — a lead reassigned after the period belongs to its current owner.
 *
 * Cold / Warm / Hot: the existing Lead Status bucket rule (statusReason + LeadStatusConfig keys),
 * via listStatusBucketFilter.buildBucketExpression — never Lead.temperature / isHot / scores.
 * Everything else, including converted leads, is Unclassified, so
 * assigned = cold + warm + hot + unclassified always holds.
 *
 * Period days are calendar days in the organisation timezone (orgTimezone), independent of the
 * server's own timezone.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

function requireString(value, label) {
  if (typeof value !== 'string') throw new ApiError(400, `${label} is invalid`);
  return value.trim();
}

function parseObjectId(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const raw = requireString(value, label);
  if (!OBJECT_ID.test(raw)) throw new ApiError(400, `${label} is invalid`);
  return new mongoose.Types.ObjectId(raw);
}

/** 'YYYY-MM-DD' -> Date anchored at noon UTC (same calendar day in the org timezone), or null. */
function parseCalendarDay(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const raw = requireString(value, label);
  const anchor = new Date(`${raw}T12:00:00Z`);
  if (!DATE_ONLY.test(raw) || Number.isNaN(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== raw) {
    throw new ApiError(400, `${label} must be a valid YYYY-MM-DD date`);
  }
  return anchor;
}

/**
 * Validates and normalises the raw query. `branchId` is the server-resolved scope (req.branchId,
 * set by the auth middleware) — never a value read straight from the request body/query here.
 */
function parseExecutiveLeadStatusQuery(query = {}, branchId = null) {
  const fromAnchor = parseCalendarDay(query.dateFrom, 'dateFrom');
  const toAnchor = parseCalendarDay(query.dateTo, 'dateTo');
  if (fromAnchor && toAnchor && fromAnchor > toAnchor) {
    throw new ApiError(400, 'dateFrom must not be after dateTo');
  }

  const executiveId = parseObjectId(query.executiveId, 'executive');

  let source = null;
  if (query.source !== undefined && query.source !== null && query.source !== '') {
    source = requireString(query.source, 'source');
    if (!Lead.schema.path('source').enumValues.includes(source)) {
      throw new ApiError(400, 'source is invalid');
    }
  }

  return {
    branchId: branchId ? parseObjectId(String(branchId), 'branch') : null,
    executiveId,
    source,
    dateFrom: fromAnchor ? fromAnchor.toISOString().slice(0, 10) : null,
    dateTo: toAnchor ? toAnchor.toISOString().slice(0, 10) : null,
    periodStart: fromAnchor ? startOfCalendarDay(fromAnchor) : null,
    periodEnd: toAnchor ? endOfCalendarDay(toAnchor) : null,
  };
}

function buildAssignedMatch({ branchId, executiveId, source, periodStart, periodEnd }) {
  const match = {
    isDeleted: { $ne: true },
    assignedTo: executiveId || { $ne: null },
  };
  if (branchId) match.branchId = branchId;
  if (source) match.source = source;
  if (periodStart || periodEnd) {
    match.assignedAt = {
      ...(periodStart ? { $gte: periodStart } : {}),
      ...(periodEnd ? { $lte: periodEnd } : {}),
    };
  }
  return match;
}

const countWhen = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });

/** Per-bucket counters shared by the overview ($group by owner) and the drill-down summary. */
const BUCKET_COUNTERS = {
  assigned: { $sum: 1 },
  cold: countWhen({ $eq: ['$leadStatusBucket', 'cold'] }),
  warm: countWhen({ $eq: ['$leadStatusBucket', 'warm'] }),
  hot: countWhen({ $eq: ['$leadStatusBucket', 'hot'] }),
  unclassified: countWhen({ $eq: ['$leadStatusBucket', 'unclassified'] }),
};

/** Adds `leadStatusBucket`: 'cold' | 'warm' | 'hot' | 'unclassified' (the single bucket rule). */
const bucketStage = () => ({
  $addFields: { leadStatusBucket: { $ifNull: [buildBucketExpression(), 'unclassified'] } },
});

async function getExecutiveLeadStatus(params) {
  // Refresh the Cold/Warm/Hot key snapshot (30s cached) so the bucket rule reflects the current
  // Lead Status config, the same config the Lead Status filter reads.
  await getConfig({ includeDisabled: false });

  const grouped = await Lead.aggregate([
    { $match: buildAssignedMatch(params) },
    bucketStage(),
    { $group: { _id: '$assignedTo', ...BUCKET_COUNTERS } },
  ]);
  const countsByOwner = new Map(grouped.map((row) => [String(row._id), row]));

  // One user query for the whole report: every active executive in scope (so executives with no
  // leads in the period still show as zero rows) plus any owner of a matching lead.
  const rosterFilter = {
    role: 'sales_executive',
    status: 'active',
    ...(params.branchId ? { branchId: params.branchId } : {}),
    ...(params.executiveId ? { _id: params.executiveId } : {}),
  };
  const users = await User.find({ $or: [rosterFilter, { _id: { $in: grouped.map((row) => row._id) } }] })
    .select('name email role')
    .lean();

  const executives = users
    .filter((user) => user.role === 'sales_executive')
    .map((user) => {
      const counts = countsByOwner.get(String(user._id));
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        assigned: counts?.assigned || 0,
        cold: counts?.cold || 0,
        warm: counts?.warm || 0,
        hot: counts?.hot || 0,
        unclassified: counts?.unclassified || 0,
      };
    })
    .sort((a, b) => b.assigned - a.assigned || String(a.name).localeCompare(String(b.name)));

  const executiveIds = new Set(executives.map((row) => String(row._id)));
  // Leads in scope currently owned by a non-executive (team leader / manager) or an owner that no
  // longer exists — not part of any executive row, reported so totals are never silently short.
  const otherOwnersAssigned = grouped
    .filter((row) => !executiveIds.has(String(row._id)))
    .reduce((sum, row) => sum + row.assigned, 0);

  const totals = executives.reduce(
    (acc, row) => ({
      assigned: acc.assigned + row.assigned,
      cold: acc.cold + row.cold,
      warm: acc.warm + row.warm,
      hot: acc.hot + row.hot,
      unclassified: acc.unclassified + row.unclassified,
    }),
    { assigned: 0, cold: 0, warm: 0, hot: 0, unclassified: 0 }
  );

  return {
    period: {
      field: 'assignedAt',
      timezone: ORG_TZ,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    },
    filters: {
      branchId: params.branchId ? String(params.branchId) : null,
      executiveId: params.executiveId ? String(params.executiveId) : null,
      source: params.source,
    },
    totals,
    executives,
    otherOwnersAssigned,
  };
}

const LEAD_BUCKETS = ['cold', 'warm', 'hot', 'unclassified'];
const DRILL_DOWN_PAGE = { defaultLimit: 25, maxLimit: 100 };

/**
 * Query for the executive drill-down. Filters (period / source / branch) are validated by the
 * overview's own parser so the two endpoints can never disagree on what a period or source means;
 * the executive comes from the route, plus optional `bucket` and pagination.
 */
function parseExecutiveLeadStatusLeadsQuery(query = {}, executiveId, branchId = null) {
  const base = parseExecutiveLeadStatusQuery({ ...query, executiveId }, branchId);
  if (!base.executiveId) throw new ApiError(400, 'executive is invalid');

  let bucket = null;
  if (query.bucket !== undefined && query.bucket !== null && query.bucket !== '') {
    bucket = requireString(query.bucket, 'bucket');
    if (!LEAD_BUCKETS.includes(bucket)) throw new ApiError(400, 'bucket is invalid');
  }

  return { ...base, bucket, ...parsePagination(query, DRILL_DOWN_PAGE) };
}

/**
 * All leads in ONE executive's overview row (same $match, same bucket stage), newest assignment
 * first with _id as a tie-breaker so pages are deterministic. `summary` always covers the whole
 * row (never narrowed by `bucket` or paging), so it equals the overview row exactly and
 * assigned = cold + warm + hot + unclassified. One aggregation ($facet) + one user lookup + the
 * batched phone-visibility gate; nothing is loaded beyond the requested page.
 */
async function getExecutiveLeadStatusLeads(params) {
  await getConfig({ includeDisabled: false });

  const executive = await User.findOne({ _id: params.executiveId, role: 'sales_executive' })
    .select('name email branchId')
    .lean();
  if (!executive) throw new ApiError(404, 'Executive not found');

  const [result] = await Lead.aggregate([
    { $match: buildAssignedMatch(params) },
    bucketStage(),
    {
      $facet: {
        summary: [{ $group: { _id: null, ...BUCKET_COUNTERS } }],
        rows: [
          ...(params.bucket ? [{ $match: { leadStatusBucket: params.bucket } }] : []),
          { $sort: { assignedAt: -1, _id: -1 } },
          { $skip: params.skip },
          { $limit: params.limit },
          {
            $project: {
              leadId: 1,
              name: 1,
              phone: 1,
              destination: 1,
              travelDate: 1,
              status: 1,
              statusReason: 1,
              source: 1,
              assignedTo: 1,
              assignedAt: 1,
              bucket: '$leadStatusBucket',
            },
          },
        ],
      },
    },
  ]);

  const counts = result?.summary?.[0] || {};
  const summary = Object.fromEntries(
    Object.keys(BUCKET_COUNTERS).map((key) => [key, counts[key] || 0])
  );
  const total = params.bucket ? summary[params.bucket] : summary.assigned;

  // Same call-gated masking as every other lead list: Admin sees 'XXXX' until the first call.
  const gated = await applyPhoneVisibilityGate(result?.rows || []);

  // Which of this page's leads Cold Calling is already working — ONE batched lookup for the page,
  // read from the assignment records (never inferred from Lead.assignedTo, which stays the Sales owner).
  const assignments = gated.length
    ? await ColdCallingAssignment.find({ leadId: { $in: gated.map((lead) => lead._id) }, status: 'active' })
        .select('leadId coldCallerId coldCallerName assignedAt')
        .lean()
    : [];
  const assignmentByLead = new Map(assignments.map((row) => [String(row.leadId), row]));

  const rows = gated.map(({ assignedTo, phoneVisible, ...lead }) => {
    const held = assignmentByLead.get(String(lead._id));
    return {
      ...lead,
      coldCalling: held
        ? { assignmentId: held._id, coldCallerId: held.coldCallerId, coldCallerName: held.coldCallerName, assignedAt: held.assignedAt }
        : null,
    };
  });

  return {
    executive: { _id: executive._id, name: executive.name, email: executive.email, branchId: executive.branchId || null },
    ...paginatedResponse(rows, { page: params.page, limit: params.limit, total }),
    summary,
    period: { field: 'assignedAt', timezone: ORG_TZ, dateFrom: params.dateFrom, dateTo: params.dateTo },
    filters: {
      branchId: params.branchId ? String(params.branchId) : null,
      source: params.source,
      bucket: params.bucket,
    },
  };
}

module.exports = {
  buildAssignedMatch,
  bucketStage,
  parseObjectId,
  getExecutiveLeadStatus,
  getExecutiveLeadStatusLeads,
  parseExecutiveLeadStatusQuery,
  parseExecutiveLeadStatusLeadsQuery,
};
