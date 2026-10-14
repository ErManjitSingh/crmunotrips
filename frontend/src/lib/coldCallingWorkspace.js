import { ROLE_LABELS } from '../auth/constants';

export const COLD_CALLING_HOME_PATH = '/cold-calling';
export const COLD_CALLING_LEADS_PATH = '/cold-calling/leads';

/**
 * My Leads filters — one per dashboard card (`summaryKey`). The backend applies the same rules as the
 * card counts (GET /cold-calling/my-leads?view=), so a card and its filtered list always agree.
 */
export const MY_LEADS_VIEWS = [
  { key: 'all', summaryKey: 'assigned', label: 'All Assigned' },
  { key: 'called_today', summaryKey: 'calledToday', label: 'Called Today' },
  { key: 'still_cold', summaryKey: 'stillCold', label: 'Still Cold' },
  { key: 'moved_warm', summaryKey: 'movedToWarm', label: 'Moved to Warm' },
  { key: 'moved_hot', summaryKey: 'movedToHot', label: 'Moved to Hot' },
];

/** Unknown / missing `?view=` falls back to 'all'. */
export function resolveMyLeadsView(value) {
  return MY_LEADS_VIEWS.some((v) => v.key === value) ? value : 'all';
}

/** My Leads URL for a view ('all' keeps the plain path). */
export function myLeadsPathFor(view) {
  return view && view !== 'all' ? `${COLD_CALLING_LEADS_PATH}?view=${view}` : COLD_CALLING_LEADS_PATH;
}

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

const toCount = (value) => (value == null ? null : Number(value) || 0);

/**
 * Card values from GET /cold-calling/my-summary. While it has not loaded (or failed) every value is `null`,
 * so the cards show '—' rather than a fake 0.
 */
export function buildCallingSummary(data) {
  return {
    assigned: toCount(data?.assigned),
    calledToday: toCount(data?.calledToday),
    stillCold: toCount(data?.stillCold),
    movedToWarm: toCount(data?.movedToWarm),
    movedToHot: toCount(data?.movedToHot),
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
