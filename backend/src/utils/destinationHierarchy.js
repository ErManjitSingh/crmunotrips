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

  // Token match (e.g. "gj test" → GJ → Gujarat)
  const tokens = raw.split(/[^a-zA-Z0-9]+/).map((t) => normalizeDestinationKey(t)).filter(Boolean);
  for (const token of tokens) {
    if (token && byKey.has(token)) return byKey.get(token);
  }

  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length);

  // Short codes (gj, hp): prefix on normalized text — "gjtest" → Gujarat
  for (const key of keys) {
    if (key.length === 2 && fullKey.startsWith(key)) return byKey.get(key);
  }

  for (const key of keys) {
    if (key.length >= 3 && fullKey.includes(key)) return byKey.get(key);
  }

  return null;
}

function blankMetrics(metricFields) {
  const row = {};
  for (const field of metricFields) row[field] = 0;
  return row;
}

/**
 * Collapse free-text destination rows into known parent states.
 * e.g. "kerala june", "uno 5N6D Kerala Package" → single "Kerala" row.
 * Unmapped junk (e.g. "gj test") groups under Other by default.
 */
async function rollupCityStatsIntoStates(rows = [], options = {}) {
  const {
    nameField = 'destination',
    metricFields = ['total', 'converted'],
    rateConfig = null, // { field, numerator, denominator }
    sortField = null,
    limit = null,
    collapseChildren = true,
    groupUnknownAs = 'Other',
  } = options;

  if (!Array.isArray(rows) || !rows.length) return rows;

  const byKey = await loadStateHierarchyIndex();
  if (!byKey.size) return rows;

  const working = new Map();
  for (const row of rows) {
    const name = String(row?.[nameField] || '').trim();
    if (!name) continue;
    const key = normalizeDestinationKey(name) || name.toLowerCase();
    const existing = working.get(key);
    if (!existing) {
      working.set(key, { ...row, [nameField]: name });
      continue;
    }
    for (const field of metricFields) {
      existing[field] = (Number(existing[field]) || 0) + (Number(row[field]) || 0);
    }
  }

  const childKeysToRemove = [];

  for (const row of [...working.values()]) {
    const name = row[nameField];
    const parent = resolveStateForDestination(name, byKey);
    if (!parent) continue;

    const rowKey = normalizeDestinationKey(name);
    if (rowKey === parent.key) {
      row[nameField] = parent.name;
      working.set(parent.key, row);
      continue;
    }

    let stateRow = working.get(parent.key);
    if (!stateRow) {
      stateRow = { [nameField]: parent.name, ...blankMetrics(metricFields) };
      working.set(parent.key, stateRow);
    } else {
      stateRow[nameField] = parent.name;
    }

    for (const field of metricFields) {
      stateRow[field] = (Number(stateRow[field]) || 0) + (Number(row[field]) || 0);
    }

    if (collapseChildren && rowKey) childKeysToRemove.push(rowKey);
  }

  for (const key of childKeysToRemove) {
    working.delete(key);
  }

  if (groupUnknownAs) {
    const otherLabel = String(groupUnknownAs).trim() || 'Other';
    const otherKey = normalizeDestinationKey(otherLabel) || 'other';
    let otherRow = null;
    const unknownKeys = [];

    for (const [key, row] of working.entries()) {
      if (key === otherKey) continue;
      if (resolveStateForDestination(row[nameField], byKey)) continue;
      unknownKeys.push(key);
      if (!otherRow) {
        otherRow = working.get(otherKey) || {
          [nameField]: otherLabel,
          ...blankMetrics(metricFields),
        };
        otherRow[nameField] = otherLabel;
      }
      for (const field of metricFields) {
        otherRow[field] = (Number(otherRow[field]) || 0) + (Number(row[field]) || 0);
      }
    }

    for (const key of unknownKeys) working.delete(key);
    if (otherRow) {
      const hasAny = metricFields.some((f) => Number(otherRow[f]) > 0);
      if (hasAny) working.set(otherKey, otherRow);
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
