const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CallNote = require('../models/CallNote');
const LeadActivity = require('../models/LeadActivity');
const ColdCallingAssignment = require('../models/ColdCallingAssignment');
const ApiError = require('../utils/apiError');
const { bucketOutcome } = require('../models/CallNote');
const { calendarParts, ORG_TZ } = require('../utils/orgTimezone');
const { logLeadActivity } = require('./leadActivityService');

/**
 * Per-lead, per-agent Cold Calling history, grouped by day: when the agent OPENED the lead (the number was
 * revealed to dial — POST /cold-calling/leads/:id/call-access) and every call they logged on it.
 *
 *   opens  LeadActivity type 'cold_calling_lead_opened' (recorded from call-access; none exist before this feature)
 *   calls  CallNote by this agent on this lead (the one existing call record — nothing is double-counted)
 *
 * Days are calendar days in the org timezone, newest first. Each source is capped so one very busy lead
 * can never produce an unbounded response; `truncated` says when the cap was hit.
 */
const OPENED_TYPE = 'cold_calling_lead_opened';
const EVENT_CAP = 500;

/** Record that the agent opened this lead for a call. Never blocks the call: a logging failure is swallowed. */
async function recordLeadOpened({ lead, user }) {
  try {
    await logLeadActivity({ leadId: lead._id, branchId: lead.branchId, type: OPENED_TYPE, actor: user });
  } catch (error) {
    console.error('[cold-calling] failed to record lead open', error?.message);
  }
}

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

function emptyDay(date) {
  return { date, opens: 0, calls: 0, connected: 0, talkTimeSec: 0, events: [] };
}

async function getAgentLeadActivity({ coldCallerId, leadId }) {
  const userId = toObjectId(coldCallerId);
  const lead = toObjectId(leadId);

  const [opens, calls] = await Promise.all([
    LeadActivity.find({ leadId: lead, actorId: userId, type: OPENED_TYPE })
      .select('createdAt')
      .sort({ createdAt: -1 })
      .limit(EVENT_CAP)
      .lean(),
    CallNote.find({ leadId: lead, userId })
      .select('outcome notes duration startedAt endedAt createdAt')
      .sort({ startedAt: -1, createdAt: -1 })
      .limit(EVENT_CAP)
      .lean(),
  ]);

  const events = [
    ...opens.map((o) => ({ type: 'opened', id: String(o._id), at: o.createdAt })),
    ...calls.map((c) => {
      const bucket = bucketOutcome(c.outcome);
      return {
        type: 'call',
        id: String(c._id),
        at: c.startedAt || c.createdAt,
        endedAt: c.endedAt || null,
        duration: c.duration || 0,
        outcome: c.outcome,
        bucket,
        notes: c.notes || '',
      };
    }),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const days = new Map();
  const totals = { opens: 0, calls: 0, connected: 0, talkTimeSec: 0 };
  for (const event of events) {
    const key = calendarParts(new Date(event.at)).key;
    if (!days.has(key)) days.set(key, emptyDay(key));
    const day = days.get(key);
    day.events.push(event);
    if (event.type === 'opened') {
      day.opens += 1;
      totals.opens += 1;
    } else {
      day.calls += 1;
      day.talkTimeSec += event.duration;
      totals.calls += 1;
      totals.talkTimeSec += event.duration;
      if (event.bucket === 'connected') {
        day.connected += 1;
        totals.connected += 1;
      }
    }
  }

  const firstOf = (type) => [...events].reverse().find((e) => e.type === type)?.at || null;
  const lastOf = (type) => events.find((e) => e.type === type)?.at || null;

  return {
    timezone: ORG_TZ,
    totals: {
      ...totals,
      activeDays: days.size,
      firstOpenedAt: firstOf('opened'),
      lastOpenedAt: lastOf('opened'),
      firstCallAt: firstOf('call'),
      lastCallAt: lastOf('call'),
    },
    days: [...days.values()],
    truncated: opens.length === EVENT_CAP || calls.length === EVENT_CAP,
  };
}

/**
 * Admin view of one agent's history on one lead. The lead must be in the Admin's branch scope and must have
 * been assigned to this agent at some point (any assignment status, so history stays readable). Every
 * failure is the same 404.
 */
async function getAgentLeadActivityForAdmin({ agentId, leadId, branchId }) {
  const valid = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
  if (!valid(agentId) || !valid(leadId)) throw new ApiError(404, 'Lead not found');
  const [lead, assignment] = await Promise.all([
    Lead.findOne({ _id: leadId, ...(branchId ? { branchId } : {}) }).select('_id').lean(),
    ColdCallingAssignment.exists({ leadId, coldCallerId: agentId }),
  ]);
  if (!lead || !assignment) throw new ApiError(404, 'Lead not found');
  return getAgentLeadActivity({ coldCallerId: agentId, leadId });
}

module.exports = { OPENED_TYPE, recordLeadOpened, getAgentLeadActivity, getAgentLeadActivityForAdmin };
