import { ROLE_LABELS } from '../auth/constants';

export const COLD_CALLING_HOME_PATH = '/cold-calling';
export const COLD_CALLING_LEADS_PATH = '/cold-calling/leads';

/**
 * Honest empty state for the summary cards. There is no Cold Calling assignment system yet, so every
 * count is a real zero — never a placeholder number. When lead assignment exists, the workspace
 * passes real counts in instead of using this.
 */
export const EMPTY_CALLING_SUMMARY = Object.freeze({
  assigned: 0,
  calledToday: 0,
  stillCold: 0,
  movedToWarm: 0,
  movedToHot: 0,
});

/**
 * Summary from the real assignment total (`null` while it is not known yet). Only Assigned Leads exists so far; the other four need the
 * calling workflow (a later phase), so they are `null` and the cards show '—' rather than a fake 0.
 */
export function buildCallingSummary(assignedTotal) {
  return {
    assigned: assignedTotal == null ? null : Number(assignedTotal) || 0,
    calledToday: null,
    stillCold: null,
    movedToWarm: null,
    movedToHot: null,
  };
}

/** "Good morning" / "Good afternoon" / "Good evening" for the given clock hour (0–23). */
export function getDayPartGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Who the workspace is for, taken from the authenticated user — nothing hardcoded. */
export function getWorkspaceIdentity(user) {
  const fullName = String(user?.name || '').trim();
  return {
    fullName,
    firstName: fullName.split(/\s+/)[0] || '',
    roleLabel: user?.roleName || ROLE_LABELS[user?.role] || 'Cold Calling',
  };
}

export function getInitials(name) {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}
