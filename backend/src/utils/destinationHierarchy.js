const Destination = require('../models/Destination');
const { normalizeDestinationKey } = require('../models/Destination');
const { MARGIN_STATES } = require('../services/destinationMarginService');
const Lead = require('../models/Lead');

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

  // Reverse of the check above: the raw text is itself a shorter abbreviation/prefix of a known
  // state name or alias (e.g. "Arunachal" -> "Arunachal Pradesh"). Same >=3-char confidence
  // threshold as the forward substring check, just applied in the other direction — this was the
  // one asymmetry in an otherwise-symmetric fuzzy match, not a new matching strategy.
  if (fullKey.length >= 3) {
    for (const key of keys) {
      if (key.length > fullKey.length && key.includes(fullKey)) return byKey.get(key);
    }
  }

  return null;
}

/** Aliases the codebase already treats as "the missing-destination bucket," whichever label a
 * given call site chose to display it under (Other/Others on the capped card, Not specified on
 * the full breakdown — see rollupCityStatsIntoStates callers). */
const MISSING_DESTINATION_KEYS = new Set(['other', 'others', 'notspecified']);

/** A real destination name — including known multi-word ones like "Jammu and Kashmir" or
 * "Andaman and Nicobar" — is short. Chat/webhook-sourced leads sometimes end up with a full
 * question or request in the destination field instead (e.g. "Connect me with team head",
 * "Have you any package for Mathura Vrindavan temples area"). Beyond this many words, a value
 * reads as a sentence rather than a place name. */
const MAX_PLAUSIBLE_DESTINATION_WORDS = 4;

/** Common English function/question words that essentially never appear in a geographic place
 * name, only in a sentence about one. A secondary signal (on top of the word-count check above)
 * for shorter free-text values ("call me now"), not a list of specific known-bad phrases — any
 * value matching this structure is caught the same way, present or future. */
const SENTENCE_LIKE_WORDS = new Set([
  'me', 'my', 'you', 'your', 'i', 'we', 'us', 'please', 'connect', 'have', 'has', 'had', 'any',
  'want', 'need', 'looking', 'help', 'team', 'head', 'package', 'packages', 'kindly', 'can',
  'could', 'would', 'will', 'should', 'is', 'are', 'do', 'does', 'did', 'what', 'when', 'how',
  'why', 'who', 'call', 'contact', 'send', 'share', 'give',
]);

/**
 * Does this destination value read as free-form lead/inquiry text rather than a place name?
 * Deliberately a structural heuristic (word count / question mark / common sentence words), NOT
 * a list of specific known-bad strings, so any sufficiently sentence-like value is caught the
 * same way rather than only the two examples that surfaced this issue.
 */
function looksLikeFreeformText(trimmed) {
  if (trimmed.includes('?')) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > MAX_PLAUSIBLE_DESTINATION_WORDS) return true;
  if (words.length >= 2) {
    return words.some((w) => SENTENCE_LIKE_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')));
  }
  return false;
}

/**
 * Classify one destination value into the bucket it belongs to — the SINGLE rule both the
 * dashboard rollup (rollupCityStatsIntoStates) and the Leads drill-down
 * (resolveDestinationGroupValues) use, so the two can never disagree about what a lead's
 * destination "really" groups into:
 *   - empty/whitespace, or already one of the missing-destination markers -> the missing bucket
 *   - resolves to a known state via the existing hierarchy (exact/alias/fuzzy match) -> that state
 *   - free-form inquiry text that isn't a place name at all (see looksLikeFreeformText) -> the
 *     missing bucket too — it must never become a fake "destination"
 *   - a real, non-empty, place-name-shaped value the hierarchy doesn't recognize -> preserved as
 *     its OWN bucket, keyed by its own normalized text. To make a specific value resolve, extend
 *     the hierarchy itself (MARGIN_STATES / the Destination collection's aliases) — never
 *     special-case it here.
 */
function classifyDestination(rawText, byKey, missingLabel = 'Not specified') {
  const trimmed = String(rawText || '').trim();
  const trimmedKey = trimmed ? normalizeDestinationKey(trimmed) : '';
  if (!trimmed || MISSING_DESTINATION_KEYS.has(trimmedKey)) {
    return { missing: true, key: normalizeDestinationKey(missingLabel) || 'notspecified', name: missingLabel };
  }
  const resolved = resolveStateForDestination(trimmed, byKey);
  if (resolved) return { missing: false, key: resolved.key, name: resolved.name };
  if (looksLikeFreeformText(trimmed)) {
    return { missing: true, key: normalizeDestinationKey(missingLabel) || 'notspecified', name: missingLabel };
  }
  return { missing: false, key: trimmedKey || trimmed.toLowerCase(), name: trimmed };
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
    const missingKeys = [];

    for (const [key, row] of working.entries()) {
      if (key === otherKey) continue;
      // Only genuinely missing/unspecified destinations fold into this bucket. A real, non-empty
      // destination the hierarchy simply doesn't recognize (e.g. "Arunachal" with no matching
      // state/alias) is NOT "missing" — it stays as its own preserved row (see classifyDestination)
      // instead of being silently discarded into Other/Not specified.
      const classification = classifyDestination(row[nameField], byKey, otherLabel);
      if (!classification.missing) continue;
      missingKeys.push(key);
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

    for (const key of missingKeys) working.delete(key);
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

  if (limit != null && limit > 0 && result.length > limit) {
    if (groupUnknownAs) {
      // Fold everything beyond the display limit into the Other bucket instead of dropping it —
      // every matching lead must still be represented in the returned rows (sum(rows) must equal
      // the population that was passed in). Other always gets a reserved slot so overflow never
      // has nowhere to go, even when nothing was already unmapped.
      const otherLabel = String(groupUnknownAs).trim() || 'Other';
      const otherKey = normalizeDestinationKey(otherLabel) || 'other';
      const otherIndex = result.findIndex(
        (row) => (normalizeDestinationKey(row[nameField]) || '') === otherKey
      );
      const existingOther = otherIndex >= 0 ? result[otherIndex] : null;
      const withoutOther = existingOther
        ? result.filter((_, i) => i !== otherIndex)
        : result;

      const keepCount = Math.max(limit - 1, 0);
      const kept = withoutOther.slice(0, keepCount);
      const overflow = withoutOther.slice(keepCount);

      if (overflow.length) {
        const otherRow = existingOther
          ? { ...existingOther }
          : { [nameField]: otherLabel, ...blankMetrics(metricFields) };
        otherRow[nameField] = otherLabel;
        for (const row of overflow) {
          for (const field of metricFields) {
            otherRow[field] = (Number(otherRow[field]) || 0) + (Number(row[field]) || 0);
          }
        }
        if (rateConfig?.field && rateConfig.numerator && rateConfig.denominator) {
          const den = Number(otherRow[rateConfig.denominator]) || 0;
          const num = Number(otherRow[rateConfig.numerator]) || 0;
          otherRow[rateConfig.field] = den ? Math.round((num / den) * 1000) / 10 : 0;
        }
        result = [...kept, otherRow];
      } else {
        // Nothing overflowed past the reserved slot — keep Other as-is if it already existed.
        result = existingOther ? [...kept, existingOther] : kept;
      }

      result.sort((a, b) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0));
    } else {
      // No Other bucket requested by this caller — unchanged legacy behavior (plain truncation).
      result = result.slice(0, limit);
    }
  }

  return result;
}

function invalidateStateHierarchyCache() {
  hierarchyCache = { at: 0, byKey: new Map() };
}

/**
 * Resolve one or more Top Destinations rollup names (e.g. "Himachal Pradesh", a preserved
 * unrecognized destination like "Arunachal", or the missing-destination bucket under whichever
 * label it was displayed as — "Other"/"Others"/"Not specified") back to the exact raw
 * `Lead.destination` values that rollupCityStatsIntoStates would have grouped into them, scoped
 * by `matchFilter` (same branch/date/source scope the dashboard used to build the chart). Uses
 * the exact same classifyDestination rule the aggregation side uses, so a click here can never
 * disagree with what the dashboard counted — never redefine "destination" elsewhere.
 */
async function resolveDestinationGroupValues(names, matchFilter = {}) {
  const list = (Array.isArray(names) ? names : [names])
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  if (!list.length) return [];

  const byKey = await loadStateHierarchyIndex();
  const targetKeys = new Set(list.map((n) => normalizeDestinationKey(n)));

  const distinctValues = await Lead.distinct('destination', matchFilter);
  const matches = [];
  for (const raw of distinctValues) {
    const classification = classifyDestination(raw, byKey);
    if (targetKeys.has(classification.key)) matches.push(raw);
  }
  return matches;
}

module.exports = {
  loadStateHierarchyIndex,
  resolveStateForDestination,
  rollupCityStatsIntoStates,
  resolveDestinationGroupValues,
  invalidateStateHierarchyCache,
};
