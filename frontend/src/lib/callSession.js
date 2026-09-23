import API from '../api/axios';
import { coldCallingCallAccessPath } from './coldCallingCalls';

const CALL_SESSION_KEY = 'uno-crm-active-call-session';
/** Cap on how long dialing waits for the backend to confirm Opened — keeps a slow/offline
 * network from blocking the executive's ability to place a call; addCallNote's own
 * markLeadViewedByExecutive safety net still guarantees Opened gets set once the call lands. */
const CALL_ACCESS_TIMEOUT_MS = 4000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function formatCallDuration(totalSeconds = 0) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  // Always exact mm:ss (e.g. 0:45, 2:05, 12:03)
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Human label with total seconds, e.g. "2:05 (125s)" */
export function formatCallDurationExact(totalSeconds = 0) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return `${formatCallDuration(s)} (${s}s)`;
}

/**
 * Human-readable h/m(/s) duration for report summaries — same underlying seconds value as
 * formatCallDuration, just presented as "1h 20m 51s" instead of "80:51". Only non-zero units are
 * shown (e.g. "2h" not "2h 0m"). Pass `includeSeconds: true` when the exact seconds matter (e.g. a
 * single call's duration); leave it off for aggregate/report totals where whole minutes suffice
 * (e.g. "1h 20m" rather than "1h 20m 51s").
 */
export function formatDurationHuman(totalSeconds = 0, { includeSeconds = false } = {}) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (includeSeconds && seconds) parts.push(`${seconds}s`);

  if (parts.length) return parts.join(' ');
  // Sub-minute total with no seconds shown would otherwise render as nothing — fall back to
  // seconds so real (if brief) activity is never displayed as blank.
  return seconds ? `${seconds}s` : '0m';
}

export function startCallSession({ leadId, leadName, phone, coldCalling = false }) {
  if (!leadId || !phone) return null;
  const session = {
    leadId: String(leadId),
    leadName: leadName || 'Customer',
    phone: String(phone),
    startedAt: Date.now(),
    dialedAt: Date.now(),
    // Which call-end endpoint the post-call form must use. Only a routing hint: the server decides
    // (from the signed-in role and the lead's assignment) whether the call is allowed.
    ...(coldCalling ? { coldCalling: true } : {}),
  };
  try {
    sessionStorage.setItem(CALL_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  return session;
}

export function peekCallSession() {
  try {
    const raw = sessionStorage.getItem(CALL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCallSession() {
  try {
    sessionStorage.removeItem(CALL_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Elapsed seconds since dial — used as approximate talk time when user returns to app */
export function getCallElapsedSeconds(session = peekCallSession()) {
  if (!session?.startedAt) return 0;
  return Math.max(0, Math.round((Date.now() - Number(session.startedAt)) / 1000));
}

export function dialLeadPhone(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  if (!clean) return;
  window.location.href = `tel:${clean}`;
}

/**
 * Clicking Call is accessing the customer's protected phone number, same as opening the lead —
 * the backend must establish the Opened state (and its audit trail) before the dialer runs, not
 * only after the call is logged. Best-effort: a slow/failed request never blocks the call itself
 * (see CALL_ACCESS_TIMEOUT_MS) — addCallNote's own safety net still guarantees Opened gets set
 * once the call is captured, so this never regresses to "call happened, lead still Not Opened."
 *
 * This is also the ONE sanctioned place the real phone number is allowed to reach the browser
 * before the first qualifying call: Lead list/detail responses mask it (`phone: 'XXXX'`, see
 * backend utils/leadPhoneVisibility) until a CallNote exists, so there is no other number to
 * dial with. The backend re-checks `assignedTo === req.user._id` on this route independently of
 * whatever the client already has in state, so only the actually-assigned executive — never an
 * Admin, who has no route to this endpoint at all — can ever obtain it, and only at the moment
 * of placing the call.
 */
async function authorizeLeadCallAccess(leadId, { coldCalling = false } = {}) {
  if (!leadId) return null;
  try {
    // Cold Calling agents use their own twin of this endpoint, which requires an active assignment.
    const url = coldCalling ? coldCallingCallAccessPath(leadId) : `/sales-executive/leads/${leadId}/call-access`;
    const { data } = await API.post(url);
    return data;
  } catch {
    return null;
  }
}

/**
 * Start tracking + open native dialer.
 * `phone` from the caller's own state may be masked ('XXXX') pre-first-call — the real number
 * for dialing always comes from authorizeLeadCallAccess's response instead (see its doc comment
 * above). Falls back to the passed-in `phone` only if that request is slow/unavailable.
 * Returns the session for callers that need it.
 */
export async function beginLeadCall({ leadId, leadName, phone, coldCalling = false }) {
  const access = await withTimeout(authorizeLeadCallAccess(leadId, { coldCalling }), CALL_ACCESS_TIMEOUT_MS);
  // A Cold Calling agent has no number of their own to fall back on: without the server's go-ahead
  // there is no call, no timer and no post-call form.
  if (coldCalling && !access?.phone) return null;
  const dialPhone = access?.phone || phone;
  const session = startCallSession({ leadId, leadName, phone: dialPhone, coldCalling });
  if (dialPhone && dialPhone !== 'XXXX') {
    dialLeadPhone(dialPhone);
  }
  return session;
}
