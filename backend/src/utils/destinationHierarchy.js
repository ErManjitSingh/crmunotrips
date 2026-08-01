const Destination = require('../models/Destination');
const { normalizeDestinationKey } = require('../models/Destination');
const { MARGIN_STATES } = require('../services/destinationMarginService');

const HIERARCHY_CACHE_TTL_MS = 60_000;
let hierarchyCache = { at: 0, byKey: new Map() };

/**
 * Map normalized destination / city-alias keys → parent state { name, key }.
 * Uses MARGIN_STATES plus any active Destination rows with kind: 'state'.
 */
async function loadStateHierarchyIndex(force = false) {
  const now = Date.now();
  if (!force && hierarchyCache.at > 0 && now - hierarchyCache.at < HIERARCHY_CACHE_TTL_MS) {
    return hierarchyCache.byKey;
  }

  const byKey = new Map();

  const seed = (stateName, aliases = []) => {
    const name = String(stateName || '').trim();
    if (!name) return;
    const key = normalizeDestinationKey(name);
    if (!key) return;
    const entry = { name, key };
    byKey.set(key, entry);
    for (const alias of aliases) {
      const aliasKey = normalizeDestinationKey(alias);
      if (aliasKey) byKey.set(aliasKey, entry);
    }
  };

  for (const item of MARGIN_STATES) {
    seed(item.name, item.aliases || []);
  }

  try {
    const states = await Destination.find({ status: 'active', kind: 'state' })
      .select('name aliases')
      .lean();
    for (const dest of states) {
      seed(dest.name, dest.aliases || []);
    }
  } catch {
    // DB unavailable — MARGIN_STATES seed is enough
  }

  hierarchyCache = { at: now, byKey };
  return byKey;
}

function resolveStateForDestination(destinationText, byKey) {
  const raw = String(destinationText || '').trim();
  if (!raw || !byKey?.size) return null;

  const fullKey = normalizeDestinationKey(raw);
  if (fullKey && byKey.has(fullKey)) return byKey.get(fullKey);

  const parts = raw.split(/[,|/→\-–>]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const key = normalizeDestinationKey(part);
    if (key && byKey.has(key)) return byKey.get(key);
  }

  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length >= 3 && fullKey.includes(key)) return byKey.get(key);
  }

  return null;
}

/**
 * Add city-row metrics onto their parent state row (create state row if missing).
 * City rows stay as-is; state totals become own + child cities.
 */
async function rollupCityStatsIntoStates(rows = [], options = {}) {
  const {
    nameField = 'destination',
    metricFields = ['total', 'converted'],
    rateConfig = null, // { field, numerator, denominator }
    sortField = null,
    limit = null,
  } = options;

  if (!Array.isArray(rows) || !rows.length) return rows;

  const byKey = await loadStateHierarchyIndex();
  if (!byKey.size) return rows;

  const working = new Map();
  for (const row of rows) {
    const name = String(row?.[nameField] || '').trim();
    if (!name) continue;
    const key = normalizeDestinationKey(name) || name.toLowerCase();
    working.set(key, { ...row, [nameField]: name });
  }

  for (const row of [...working.values()]) {
    const name = row[nameField];
    const parent = resolveStateForDestination(name, byKey);
    if (!parent) continue;

    const rowKey = normalizeDestinationKey(name);
    if (rowKey === parent.key) continue; // already the state row

    let stateRow = working.get(parent.key);
    if (!stateRow) {
      stateRow = { [nameField]: parent.name };
      for (const field of metricFields) {
        stateRow[field] = 0;
      }
      working.set(parent.key, stateRow);
    }

    for (const field of metricFields) {
      stateRow[field] = (Number(stateRow[field]) || 0) + (Number(row[field]) || 0);
    }
  }

  let result = [...working.values()];

  if (rateConfig?.field && rateConfig.numerator && rateConfig.denominator) {
    result = result.map((row) => {
      const den = Number(row[rateConfig.denominator]) || 0;
      const num = Number(row[rateConfig.numerator]) || 0;
      return {
        ...row,
        [rateConfig.field]: den ? Math.round((num / den) * 1000) / 10 : 0,
      };
    });
  }

  const sortBy = sortField || metricFields[0];
  if (sortBy) {
    result.sort((a, b) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0));
  }

  if (limit != null && limit > 0) {
    result = result.slice(0, limit);
  }

  return result;
}

function invalidateStateHierarchyCache() {
  hierarchyCache = { at: 0, byKey: new Map() };
}

module.exports = {
  loadStateHierarchyIndex,
  resolveStateForDestination,
  rollupCityStatsIntoStates,
  invalidateStateHierarchyCache,
};
