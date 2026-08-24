const LeadStatusConfig = require('../models/LeadStatusConfig');

const DEFAULT_WARM = [
  { key: 'discussed_package', label: 'Package discussed', enabled: true, sortOrder: 0 },
  { key: 'requested_callback', label: 'Request call back', enabled: true, sortOrder: 1 },
  { key: 'cnp_same_day', label: 'CNP for same day', enabled: true, sortOrder: 2 },
  { key: 'price_negotiation', label: 'Price negotiation going on', enabled: true, sortOrder: 3 },
];

const DEFAULT_HOT = [
  { key: 'ready_to_book', label: 'Ready to Book', enabled: true, sortOrder: 0 },
];

const DEFAULT_COLD = [
  { key: 'booked_elsewhere', label: 'Booked from another company', enabled: true, sortOrder: 0 },
  { key: 'language_barrier', label: 'Language barrier', enabled: true, sortOrder: 1 },
  { key: 'not_interested', label: 'Not interested', enabled: true, sortOrder: 2 },
  { key: 'invalid_number', label: 'Invalid no', enabled: true, sortOrder: 3 },
  { key: 'budget_issues', label: 'Budget issues', enabled: true, sortOrder: 4 },
];

const LEGACY_COLD_ALIASES = ['budget_issue'];

let cache = null;
let cacheAt = 0;
let syncSnapshot = {
  warm: DEFAULT_WARM.filter((o) => o.enabled).map((o) => ({ key: o.key, label: o.label })),
  hot: DEFAULT_HOT.filter((o) => o.enabled).map((o) => ({ key: o.key, label: o.label })),
  cold: DEFAULT_COLD.filter((o) => o.enabled).map((o) => ({ key: o.key, label: o.label })),
};
const CACHE_MS = 30_000;

function updateSyncSnapshot(data) {
  syncSnapshot = {
    warm: (data.warm || []).filter((o) => o.enabled !== false).map((o) => ({ key: o.key, label: o.label })),
    hot: (data.hot || []).filter((o) => o.enabled !== false).map((o) => ({ key: o.key, label: o.label })),
    cold: (data.cold || []).filter((o) => o.enabled !== false).map((o) => ({ key: o.key, label: o.label })),
  };
}

/** Sync snapshot for hot paths (follow-up apply, cold detection). Falls back to defaults. */
function getCachedOptionLists() {
  return {
    warm: syncSnapshot.warm,
    hot: syncSnapshot.hot,
    cold: syncSnapshot.cold,
  };
}

function getCachedKeysByCategory() {
  const lists = getCachedOptionLists();
  return {
    warm: lists.warm.map((o) => o.key),
    hot: lists.hot.map((o) => o.key),
    cold: [...lists.cold.map((o) => o.key), ...LEGACY_COLD_ALIASES],
  };
}

function slugifyKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || `option_${Date.now()}`;
}

function normalizeOptions(list = [], { generateKey = false } = {}) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((item, index) => {
      const label = String(item?.label || '').trim();
      if (!label) return null;
      let key = String(item?.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!key || generateKey) key = slugifyKey(label);
      if (!key || seen.has(key)) {
        key = `${key || 'option'}_${index}`;
      }
      seen.add(key);
      return {
        key,
        label,
        enabled: item?.enabled !== false,
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function defaultsDoc() {
  return {
    key: 'default',
    warm: DEFAULT_WARM,
    hot: DEFAULT_HOT,
    cold: DEFAULT_COLD,
  };
}

function toPublic(doc, { includeDisabled = false } = {}) {
  const pick = (arr) =>
    normalizeOptions(arr)
      .filter((o) => includeDisabled || o.enabled)
      .map(({ key, label, enabled, sortOrder }) => ({ key, label, enabled, sortOrder }));

  return {
    warm: pick(doc.warm),
    hot: pick(doc.hot),
    cold: pick(doc.cold),
    updatedAt: doc.updatedAt || null,
  };
}

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

async function ensureConfig() {
  let doc = await LeadStatusConfig.findOne({ key: 'default' });
  if (!doc) {
    doc = await LeadStatusConfig.create(defaultsDoc());
  }
  return doc;
}

async function getConfig({ includeDisabled = false, force = false } = {}) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS && cache.includeDisabled === includeDisabled) {
    return cache.data;
  }
  const doc = await ensureConfig();
  const data = toPublic(doc.toObject ? doc.toObject() : doc, { includeDisabled });
  updateSyncSnapshot(toPublic(doc.toObject ? doc.toObject() : doc, { includeDisabled: false }));
  cache = { data, includeDisabled };
  cacheAt = now;
  return data;
}

async function getOptionKeysByCategory({ enabledOnly = true } = {}) {
  const cfg = await getConfig({ includeDisabled: !enabledOnly });
  return {
    warm: cfg.warm.map((o) => o.key),
    hot: cfg.hot.map((o) => o.key),
    cold: [...cfg.cold.map((o) => o.key), ...LEGACY_COLD_ALIASES],
  };
}

async function getAllOptionKeys({ enabledOnly = true } = {}) {
  const by = await getOptionKeysByCategory({ enabledOnly });
  return [...by.warm, ...by.hot, ...by.cold];
}

async function getLabelMap() {
  const cfg = await getConfig({ includeDisabled: true });
  const map = { working_progress: 'Working Progress' };
  for (const cat of ['warm', 'hot', 'cold']) {
    for (const o of cfg[cat]) map[o.key] = o.label;
  }
  map.budget_issue = map.budget_issues || 'Budget issues';
  return map;
}

async function saveConfig(payload, userId) {
  const warm = normalizeOptions(payload?.warm);
  const hot = normalizeOptions(payload?.hot);
  const cold = normalizeOptions(payload?.cold);

  if (!warm.length && !hot.length && !cold.length) {
    const err = new Error('At least one status option is required');
    err.statusCode = 400;
    throw err;
  }

  const allKeys = [...warm, ...hot, ...cold].map((o) => o.key);
  const unique = new Set(allKeys);
  if (unique.size !== allKeys.length) {
    const err = new Error('Option keys must be unique across Warm / Hot / Cold');
    err.statusCode = 400;
    throw err;
  }

  const doc = await ensureConfig();
  doc.warm = warm;
  doc.hot = hot;
  doc.cold = cold;
  doc.updatedBy = userId || undefined;
  await doc.save();
  invalidateCache();
  return toPublic(doc.toObject(), { includeDisabled: true });
}

async function resetToDefaults(userId) {
  return saveConfig(defaultsDoc(), userId);
}

module.exports = {
  DEFAULT_WARM,
  DEFAULT_HOT,
  DEFAULT_COLD,
  slugifyKey,
  normalizeOptions,
  invalidateCache,
  ensureConfig,
  getConfig,
  getOptionKeysByCategory,
  getAllOptionKeys,
  getLabelMap,
  getCachedOptionLists,
  getCachedKeysByCategory,
  saveConfig,
  resetToDefaults,
  toPublic,
};
