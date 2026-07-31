const Destination = require('../models/Destination');
const DestinationMargin = require('../models/DestinationMargin');
const { normalizeDestinationKey } = require('../models/Destination');
const { ensureDefaultDestinations } = require('./destinationAssignmentService');
const ApiError = require('../utils/apiError');

const MARGIN_CACHE_TTL_MS = 60_000;
let marginCache = { at: 0, byKey: new Map(), byId: new Map() };

function invalidateMarginCache() {
  marginCache = { at: 0, byKey: new Map(), byId: new Map() };
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function applyPercentUplift(amount, percent) {
  const base = Number(amount) || 0;
  const pct = Number(percent) || 0;
  if (!pct || base === 0) return roundMoney(base);
  return roundMoney(base * (1 + pct / 100));
}

async function loadMarginIndex(force = false) {
  const now = Date.now();
  if (!force && marginCache.at > 0 && now - marginCache.at < MARGIN_CACHE_TTL_MS) {
    return marginCache;
  }

  const rows = await DestinationMargin.find({ active: true, marginPercent: { $gt: 0 } })
    .populate('destinationId', 'name normalizedKey aliases status')
    .lean();

  const byKey = new Map();
  const byId = new Map();

  for (const row of rows) {
    const dest = row.destinationId;
    if (!dest || dest.status === 'inactive') continue;
    const entry = {
      destinationId: String(dest._id),
      destinationName: dest.name || row.destinationName,
      marginPercent: Number(row.marginPercent) || 0,
    };
    byId.set(entry.destinationId, entry);

    const keys = new Set([
      normalizeDestinationKey(dest.name),
      normalizeDestinationKey(row.destinationName),
      ...(dest.aliases || []).map((a) => normalizeDestinationKey(a)),
    ]);
    keys.forEach((key) => {
      if (key) byKey.set(key, entry);
    });
  }

  marginCache = { at: now, byKey, byId };
  return marginCache;
}

/**
 * Resolve margin % for a free-text destination (package / lead destination string).
 */
async function resolveMarginForDestination(destinationText = '') {
  const raw = String(destinationText || '').trim();
  if (!raw) return null;

  const { byKey } = await loadMarginIndex();
  if (!byKey.size) return null;

  const fullKey = normalizeDestinationKey(raw);
  if (fullKey && byKey.has(fullKey)) return byKey.get(fullKey);

  // Try city / first segment (e.g. "Manali, Himachal Pradesh")
  const parts = raw.split(/[,|/→\-–>]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const key = normalizeDestinationKey(part);
    if (key && byKey.has(key)) return byKey.get(key);
  }

  // Substring match against known destination keys (longest first)
  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length >= 3 && fullKey.includes(key)) return byKey.get(key);
  }

  return null;
}

function decoratePackageWithMargin(pkg, marginEntry) {
  if (!pkg || typeof pkg !== 'object') return pkg;
  const baseStartingPrice = Number(pkg.baseStartingPrice ?? pkg.startingPrice ?? 0) || 0;
  const basePrice = Number(pkg.basePrice ?? 0) || 0;
  const discountedPrice =
    pkg.discountedPrice != null ? Number(pkg.discountedPrice) : null;

  if (!marginEntry?.marginPercent) {
    return {
      ...pkg,
      baseStartingPrice,
      startingPrice: baseStartingPrice,
      destinationMarginPercent: 0,
      destinationMarginApplied: false,
    };
  }

  const pct = Number(marginEntry.marginPercent) || 0;
  return {
    ...pkg,
    baseStartingPrice,
    startingPrice: applyPercentUplift(baseStartingPrice, pct),
    ...(basePrice
      ? { basePrice: applyPercentUplift(basePrice, pct) }
      : {}),
    ...(discountedPrice != null
      ? { discountedPrice: applyPercentUplift(discountedPrice, pct) }
      : {}),
    destinationMarginPercent: pct,
    destinationMarginApplied: true,
    destinationMarginName: marginEntry.destinationName || '',
  };
}

async function applyMarginToPackage(pkg) {
  if (!pkg) return pkg;
  const destination =
    pkg.destination ||
    pkg.destinationName ||
    pkg.routing ||
    '';
  const margin = await resolveMarginForDestination(destination);
  return decoratePackageWithMargin(pkg, margin);
}

async function applyMarginToPackages(packages = []) {
  if (!Array.isArray(packages) || packages.length === 0) return packages;
  await loadMarginIndex();
  const out = [];
  for (const pkg of packages) {
    out.push(await applyMarginToPackage(pkg));
  }
  return out;
}

async function listDestinationMargins() {
  await ensureDefaultDestinations();
  const destinations = await Destination.find({ status: 'active' }).sort({ name: 1 }).lean();
  const margins = await DestinationMargin.find({
    destinationId: { $in: destinations.map((d) => d._id) },
  }).lean();
  const byDest = new Map(margins.map((m) => [String(m.destinationId), m]));

  return destinations.map((dest) => {
    const row = byDest.get(String(dest._id));
    return {
      destinationId: dest._id,
      destinationName: dest.name,
      aliases: dest.aliases || [],
      marginPercent: row ? Number(row.marginPercent) || 0 : 0,
      active: row ? row.active !== false : true,
      notes: row?.notes || '',
      updatedAt: row?.updatedAt || null,
      updatedByName: row?.updatedByName || '',
      hasMargin: Boolean(row && Number(row.marginPercent) > 0 && row.active !== false),
    };
  });
}

async function upsertDestinationMargin(req, { destinationId, marginPercent, notes, active }) {
  const destination = await Destination.findById(destinationId);
  if (!destination) throw new ApiError(404, 'Destination not found');
  if (destination.status === 'inactive') {
    throw new ApiError(400, 'Cannot set margin on an inactive destination');
  }

  const pct = Math.max(0, Math.min(500, Number(marginPercent) || 0));
  const isActive = active !== false;

  const doc = await DestinationMargin.findOneAndUpdate(
    { destinationId: destination._id },
    {
      $set: {
        destinationName: destination.name,
        marginPercent: pct,
        active: isActive,
        notes: String(notes || '').trim().slice(0, 500),
        updatedBy: req.user?._id,
        updatedByName: req.user?.name || '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  invalidateMarginCache();
  return {
    destinationId: destination._id,
    destinationName: destination.name,
    marginPercent: doc.marginPercent,
    active: doc.active,
    notes: doc.notes,
    updatedAt: doc.updatedAt,
    updatedByName: doc.updatedByName,
    hasMargin: doc.active !== false && Number(doc.marginPercent) > 0,
  };
}

async function bulkUpsertDestinationMargins(req, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'No margin rows provided');
  }
  const results = [];
  for (const item of items) {
    if (!item?.destinationId) continue;
    results.push(
      await upsertDestinationMargin(req, {
        destinationId: item.destinationId,
        marginPercent: item.marginPercent,
        notes: item.notes,
        active: item.active,
      })
    );
  }
  return results;
}

module.exports = {
  invalidateMarginCache,
  applyPercentUplift,
  resolveMarginForDestination,
  applyMarginToPackage,
  applyMarginToPackages,
  listDestinationMargins,
  upsertDestinationMargin,
  bulkUpsertDestinationMargins,
};
