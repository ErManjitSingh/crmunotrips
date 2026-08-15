export const RESTRICTED_SESSION_ROLES = ['admin', 'sales_manager'];
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Sales executives are force-logged out at 6:20 PM IST every day. */
export const EOD_LOGOUT_ROLES = ['sales_executive'];
export const EOD_LOGOUT_HOUR = 18;
export const EOD_LOGOUT_MINUTE = 20;
export const ATTENDANCE_TZ = 'Asia/Kolkata';

export function requiresRestrictedSession(role) {
  return RESTRICTED_SESSION_ROLES.includes(role);
}

export function requiresEodLogout(role) {
  return EOD_LOGOUT_ROLES.includes(role);
}

export function getTokenIssuedAtMs(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.iat ? Number(payload.iat) * 1000 : null;
  } catch {
    return null;
  }
}

export function getTodayEodCutoffMs(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  const hh = String(EOD_LOGOUT_HOUR).padStart(2, '0');
  const mm = String(EOD_LOGOUT_MINUTE).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00+05:30`).getTime();
}

/** True when past 6:20 PM IST and the JWT was issued before today's cutoff. */
export function shouldForceEodLogout(token, now = Date.now()) {
  const cutoff = getTodayEodCutoffMs(now);
  if (now < cutoff) return false;
  const iat = getTokenIssuedAtMs(token);
  if (iat == null) return true;
  return iat < cutoff;
}
