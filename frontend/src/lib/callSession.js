const CALL_SESSION_KEY = 'uno-crm-active-call-session';

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

export function startCallSession({ leadId, leadName, phone }) {
  if (!leadId || !phone) return null;
  const session = {
    leadId: String(leadId),
    leadName: leadName || 'Customer',
    phone: String(phone),
    startedAt: Date.now(),
    dialedAt: Date.now(),
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
 * Start tracking + open native dialer.
 * Returns the session for callers that need it.
 */
export function beginLeadCall({ leadId, leadName, phone }) {
  const session = startCallSession({ leadId, leadName, phone });
  dialLeadPhone(phone);
  return session;
}
