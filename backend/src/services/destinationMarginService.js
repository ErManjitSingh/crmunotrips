const Destination = require('../models/Destination');
const DestinationMargin = require('../models/DestinationMargin');
const Package = require('../models/Package');
const { normalizeDestinationKey } = require('../models/Destination');
const ApiError = require('../utils/apiError');

const MARGIN_CACHE_TTL_MS = 60_000;
let marginCache = { at: 0, byKey: new Map(), byId: new Map(), byPackageId: new Map() };

/**
 * Margin Control is state-wise only. City names go in aliases so packages
 * with destination "Manali" still resolve to Himachal Pradesh margin.
 */
const MARGIN_STATES = [
  {
    name: 'Himachal Pradesh',
    aliases: ['Himachal', 'Manali', 'Shimla', 'Kasol', 'Dharamshala', 'Spiti', 'Kullu'],
  },
  {
    name: 'Goa',
    aliases: [],
  },
  {
    name: 'Kerala',
    aliases: ["God's Own Country", 'Munnar', 'Alleppey', 'Kochi', 'Alappuzha', 'Wayanad'],
  },
  {
    name: 'Rajasthan',
    aliases: ['Jaipur', 'Udaipur', 'Jodhpur', 'Jaisalmer', 'Pushkar'],
  },
  {
    name: 'Uttarakhand',
    aliases: ['Rishikesh', 'Mussoorie', 'Nainital', 'Haridwar', 'Auli', 'Jim Corbett'],
  },
  {
    name: 'Jammu and Kashmir',
    aliases: ['Kashmir', 'Srinagar', 'Gulmarg', 'Pahalgam', 'Jammu Kashmir'],
  },
  {
    name: 'Ladakh',
    aliases: ['Leh Ladakh', 'Leh', 'Nubra', 'Pangong'],
  },
  {
    name: 'Andaman and Nicobar',
    aliases: ['Andaman', 'Andaman Islands', 'Port Blair', 'Havelock'],
  },
  {
    name: 'Sikkim',
    aliases: ['Gangtok', 'Lachung', 'Pelling'],
  },
  {
    name: 'Meghalaya',
    aliases: ['Shillong', 'Cherrapunji'],
  },
  {
    name: 'Maharashtra',
    aliases: ['Mumbai', 'Lonavala', 'Mahabaleshwar'],
  },
  {
    name: 'Karnataka',
    aliases: ['Coorg', 'Bangalore', 'Bengaluru', 'Mysore', 'Gokarna'],
  },
  {
    name: 'Tamil Nadu',
    aliases: ['Ooty', 'Kodaikanal', 'Chennai', 'Madurai'],
  },
  {
    name: 'West Bengal',
    aliases: ['Darjeeling', 'Kolkata', 'Sundarbans'],
  },
  {
    name: 'Gujarat',
    aliases: ['Dwarka', 'Somnath', 'Kutch', 'Ahmedabad'],
  },
  {
    name: 'Punjab',
    aliases: ['Amritsar'],
  },
  {
    name: 'Odisha',
    aliases: ['Orissa', 'Puri', 'Bhubaneswar', 'Konark'],
  },
  {
    name: 'Assam',
    aliases: ['Guwahati', 'Kaziranga'],
  },
  {
    name: 'Madhya Pradesh',
    aliases: ['Khajuraho', 'Indore', 'Bhopal'],
  },
  {
    name: 'Dubai',
    aliases: ['UAE', 'Abu Dhabi'],
  },
  {
    name: 'Thailand',
    aliases: ['Bangkok', 'Phuket', 'Pattaya', 'Krabi'],
  },
  {
    name: 'Maldives',
    aliases: [],
  },
  {
    name: 'Singapore',
    aliases: [],
  },
  {
    name: 'Bali',
    aliases: ['Indonesia', 'Bali Indonesia'],
  },
];

function invalidateMarginCache() {
  marginCache = { at: 0, byKey: new Map(), byId: new Map(), byPackageId: new Map() };
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

function mergeAliases(existing = [], incoming = []) {
  const set = new Set(
    [...existing, ...incoming]
      .map((a) => String(a || '').trim())
      .filter(Boolean)
  );
  return [...set];
}

/**
 * Ensure only state-level destinations exist for margin control.
 * Does not remove city destinations used by lead assignment.
 */
async function ensureMarginStates() {
  for (const item of MARGIN_STATES) {
    const normalizedKey = normalizeDestinationKey(item.name);
    const existing = await Destination.findOne({ normalizedKey });
    if (existing) {
      const nextAliases = mergeAliases(existing.aliases, item.aliases);
      const needsUpdate =
        existing.kind !== 'state' ||
        existing.status !== 'active' ||
        nextAliases.length !== (existing.aliases || []).length ||
        nextAliases.some((a, i) => a !== (existing.aliases || [])[i]);
      if (needsUpdate) {
        existing.kind = 'state';
        existing.status = 'active';
        existing.aliases = nextAliases;
        await existing.save();
      }
      continue;
    }
    await Destination.create({
      name: item.name,
      normalizedKey,
      aliases: item.aliases || [],
      kind: 'state',
      status: 'active',
    });
  }
}

async function loadMarginIndex(force = false) {
  const now = Date.now();
  if (!force && marginCache.at > 0 && now - marginCache.at < MARGIN_CACHE_TTL_MS) {
    return marginCache;
  }

  const rows = await DestinationMargin.find({ active: true, marginPercent: { $gt: 0 } })
    .populate('destinationId', 'name normalizedKey aliases status kind')
    .lean();

  const byKey = new Map();
  const byId = new Map();
  const byPackageId = new Map();

  for (const row of rows) {
    const dest = row.destinationId;
    if (!dest || dest.status === 'inactive') continue;
    // Margin control is state-wise — skip city/region rows if any remain
    if (dest.kind && dest.kind !== 'state') continue;

    const entry = {
      destinationId: String(dest._id),
      destinationName: dest.name || row.destinationName,
      marginPercent: Number(row.marginPercent) || 0,
      packageIds: (row.packageIds || []).map((id) => String(id)),
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

    for (const pkgId of entry.packageIds) {
      if (pkgId) byPackageId.set(pkgId, entry);
    }
  }

  marginCache = { at: now, byKey, byId, byPackageId };
  return marginCache;
}

/**
 * Resolve margin % for a free-text destination (package / lead destination string).
 * Matches state name or city aliases under that state.
 */
async function resolveMarginForDestination(destinationText = '') {
  const raw = String(destinationText || '').trim();
  if (!raw) return null;

  const { byKey } = await loadMarginIndex();
  if (!byKey.size) return null;

  const fullKey = normalizeDestinationKey(raw);
  if (fullKey && byKey.has(fullKey)) return byKey.get(fullKey);

  // Try segments (e.g. "Manali, Himachal Pradesh")
  const parts = raw.split(/[,|/→\-–>]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const key = normalizeDestinationKey(part);
    if (key && byKey.has(key)) return byKey.get(key);
  }

  // Substring match against known state / city-alias keys (longest first)
  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length >= 3 && fullKey.includes(key)) return byKey.get(key);
  }

  return null;
}

async function resolveMarginForPackage(pkg) {
  if (!pkg) return null;
  const { byPackageId } = await loadMarginIndex();
  const pkgId = String(pkg._id || pkg.id || '');
  if (pkgId && byPackageId.has(pkgId)) {
    return byPackageId.get(pkgId);
  }
  const destination =
    pkg.destination ||
    pkg.destinationName ||
    pkg.routing ||
    '';
  return resolveMarginForDestination(destination);
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
  const margin = await resolveMarginForPackage(pkg);
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

function normalizePackageIds(packageIds = []) {
  if (!Array.isArray(packageIds)) return [];
  const seen = new Set();
  const out = [];
  for (const id of packageIds) {
    const s = String(id || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function listDestinationMargins() {
  await ensureMarginStates();
  const destinations = await Destination.find({ status: 'active', kind: 'state' })
    .sort({ name: 1 })
    .lean();
  const margins = await DestinationMargin.find({
    destinationId: { $in: destinations.map((d) => d._id) },
  }).lean();
  const byDest = new Map(margins.map((m) => [String(m.destinationId), m]));

  const allPackageIds = [
    ...new Set(
      margins.flatMap((m) => (m.packageIds || []).map((id) => String(id)))
    ),
  ];
  const packages = allPackageIds.length
    ? await Package.find({ _id: { $in: allPackageIds } })
        .select('_id name destination startingPrice')
        .lean()
    : [];
  const packageById = new Map(packages.map((p) => [String(p._id), p]));

  return destinations.map((dest) => {
    const row = byDest.get(String(dest._id));
    const packageIds = (row?.packageIds || []).map((id) => String(id));
    const mappedPackages = packageIds
      .map((id) => {
        const pkg = packageById.get(id);
        if (!pkg) return null;
        return {
          _id: pkg._id,
          name: pkg.name,
          destination: pkg.destination,
          startingPrice: pkg.startingPrice,
        };
      })
      .filter(Boolean);

    return {
      destinationId: dest._id,
      destinationName: dest.name,
      stateName: dest.name,
      aliases: dest.aliases || [],
      kind: 'state',
      marginPercent: row ? Number(row.marginPercent) || 0 : 0,
      packageIds,
      mappedPackages,
      active: row ? row.active !== false : true,
      notes: row?.notes || '',
      updatedAt: row?.updatedAt || null,
      updatedByName: row?.updatedByName || '',
      hasMargin: Boolean(row && Number(row.marginPercent) > 0 && row.active !== false),
    };
  });
}

async function upsertDestinationMargin(
  req,
  { destinationId, marginPercent, notes, active, packageIds }
) {
  const destination = await Destination.findById(destinationId);
  if (!destination) throw new ApiError(404, 'State not found');
  if (destination.kind !== 'state') {
    throw new ApiError(400, 'Margin can only be set on states, not cities');
  }
  if (destination.status === 'inactive') {
    throw new ApiError(400, 'Cannot set margin on an inactive state');
  }

  const pct = Math.max(0, Math.min(500, Number(marginPercent) || 0));
  const isActive = active !== false;
  const normalizedIds = normalizePackageIds(packageIds);

  if (normalizedIds.length) {
    const found = await Package.find({ _id: { $in: normalizedIds } }).select('_id').lean();
    const foundSet = new Set(found.map((p) => String(p._id)));
    const missing = normalizedIds.filter((id) => !foundSet.has(id));
    if (missing.length) {
      throw new ApiError(400, `Unknown package id(s): ${missing.slice(0, 5).join(', ')}`);
    }
  }

  // A package can only map to one state margin — remove from other rows
  if (normalizedIds.length) {
    await DestinationMargin.updateMany(
      {
        destinationId: { $ne: destination._id },
        packageIds: { $in: normalizedIds },
      },
      { $pull: { packageIds: { $in: normalizedIds } } }
    );
  }

  const setFields = {
    destinationName: destination.name,
    marginPercent: pct,
    active: isActive,
    notes: String(notes || '').trim().slice(0, 500),
    updatedBy: req.user?._id,
    updatedByName: req.user?.name || '',
  };
  if (packageIds !== undefined) {
    setFields.packageIds = normalizedIds;
  }

  const doc = await DestinationMargin.findOneAndUpdate(
    { destinationId: destination._id },
    { $set: setFields },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  invalidateMarginCache();

  const mappedPackages = doc.packageIds?.length
    ? await Package.find({ _id: { $in: doc.packageIds } })
        .select('_id name destination startingPrice')
        .lean()
    : [];

  return {
    destinationId: destination._id,
    destinationName: destination.name,
    stateName: destination.name,
    marginPercent: doc.marginPercent,
    packageIds: (doc.packageIds || []).map((id) => String(id)),
    mappedPackages,
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
        packageIds: item.packageIds,
      })
    );
  }
  return results;
}

module.exports = {
  invalidateMarginCache,
  applyPercentUplift,
  ensureMarginStates,
  resolveMarginForDestination,
  resolveMarginForPackage,
  applyMarginToPackage,
  applyMarginToPackages,
  listDestinationMargins,
  upsertDestinationMargin,
  bulkUpsertDestinationMargins,
  MARGIN_STATES,
};
