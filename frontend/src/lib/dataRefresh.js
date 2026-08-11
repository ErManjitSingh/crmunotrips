import { invalidateFromMutationKeys, normalizeKeys } from './mutationCacheSync';

export { normalizeKeys };

/** Fired after same-tab API mutations for legacy useDataRefresh listeners. */
export const DATA_CHANGED_EVENT = 'crm:data-changed';

let pendingKeys = new Set();
let emitTimer = null;

export function emitDataChanged(keys) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeKeys(keys);
  if (!normalized.length) return;

  normalized.forEach((k) => pendingKeys.add(k));
  if (emitTimer) clearTimeout(emitTimer);
  emitTimer = setTimeout(() => {
    const merged = [...pendingKeys];
    pendingKeys = new Set();
    emitTimer = null;
    invalidateFromMutationKeys(merged);
    window.dispatchEvent(
      new CustomEvent(DATA_CHANGED_EVENT, { detail: { keys: merged } })
    );
  }, 80);
}

export function shouldEmitDataRefresh(config) {
  if (!config || config.skipDataRefresh) return false;
  const method = (config.method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;

  const path = (config.url || '').split('?')[0].toLowerCase();
  if (
    path.includes('/auth/') ||
    path.includes('/invites/accept') ||
    path.includes('/notifications')
  ) {
    return false;
  }
  return true;
}

/** Map mutation URL → cache keys that should refetch. */
export function keysFromMutationUrl(url, _method) {
  const path = (url || '').split('?')[0].toLowerCase();
  const keys = new Set();

  const leadPath =
    /\/leads(\/|$)/.test(path) ||
    /\/sales-manager\/leads/.test(path) ||
    /\/sales-executive\/leads/.test(path) ||
    /\/team-leader\/leads/.test(path) ||
    /\/whatsapp\/leads/.test(path);

  if (leadPath || /\/sales-manager\/assign/.test(path) || /\/leads\/assign/.test(path)) {
    keys.add('leads');
    keys.add('nav-counts');
    // Do NOT invalidate full dashboard on every lead touch — that stampedes Mongo.
    // Dashboard refreshes on open / manual refresh / longer staleTime.
    const statusHeavy =
      /\/(status|convert|assign|merge|transfer|reactivat)/.test(path) ||
      /\/leads\/assign/.test(path);
    if (statusHeavy) keys.add('dashboard');
    const leadIdMatch = path.match(/\/leads\/([a-f0-9]{24})/);
    if (leadIdMatch) keys.add(`lead:${leadIdMatch[1]}`);
  }

  if (/\/followup/.test(path)) {
    keys.add('followups');
    keys.add('nav-counts');
  }

  if (/\/users(\/|$)/.test(path) || /\/roles(\/|$)/.test(path) || /\/team(\/|$)/.test(path)) {
    keys.add('users');
    keys.add('team');
    keys.add('dashboard');
  }

  if (/\/sales-manager\/teams/.test(path) || /\/teams(\/|$)/.test(path)) {
    keys.add('teams');
    keys.add('leads');
    keys.add('dashboard');
  }

  if (/\/quotations/.test(path)) {
    keys.add('quotations');
    // Quote edits shouldn't force full lead-list + dashboard refetch
    if (/\/leads\//.test(path)) {
      keys.add('leads');
      keys.add('dashboard');
    }
  }

  if (
    /\/packages/.test(path) ||
    /\/hotels/.test(path) ||
    /\/cabs/.test(path) ||
    /\/flights/.test(path)
  ) {
    keys.add('packages');
  }

  if (/\/whatsapp/.test(path)) {
    keys.add('whatsapp');
    if (/\/whatsapp\/leads/.test(path) || /\/leads\//.test(path)) {
      keys.add('leads');
    }
  }

  if (/\/emails/.test(path) || /\/send-email/.test(path) || /\/email-templates/.test(path)) {
    keys.add('dashboard');
  }

  if (/\/operations-manager/.test(path) || /\/payments/.test(path)) {
    keys.add('operations');
    keys.add('dashboard');
  }

  if (/\/dashboard/.test(path)) {
    keys.add('dashboard');
  }

  if (/\/activity-logs/.test(path)) {
    keys.add('activity');
  }

  if (/\/reports/.test(path)) {
    keys.add('reports');
  }

  if (/\/attendance/.test(path)) {
    keys.add('attendance');
    keys.add('dashboard');
  }

  return [...keys];
}

export function matchesDataKeys(watchKeys, changedKeys) {
  const watch = normalizeKeys(watchKeys);
  const changed = normalizeKeys(changedKeys);
  if (!watch.length || !changed.length) return false;
  if (changed.includes('*') || watch.includes('*')) return true;
  return watch.some((k) => changed.includes(k));
}
