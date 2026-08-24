/**
 * Helpers for package cab lists in quotation builder.
 */

/** Merge mapped packageCabs with raw day-options cabs (by id), prefer richer list. */
export function mergeRawCabSources(source = {}) {
  const mapped = Array.isArray(source.packageCabs)
    ? source.packageCabs
    : Array.isArray(source.package_cabs)
      ? source.package_cabs
      : [];
  const rawFromApi = Array.isArray(source._apiRaw?.dayOptions?.cabs)
    ? source._apiRaw.dayOptions.cabs
    : [];

  if (!mapped.length) return rawFromApi;
  if (!rawFromApi.length) return mapped;

  const byId = new Map();
  for (const cab of [...rawFromApi, ...mapped]) {
    const id = String(cab?.id || cab?.packageCabId || '');
    if (!id) continue;
    const prev = byId.get(id);
    byId.set(id, prev ? { ...prev, ...cab } : cab);
  }
  // Prefer whichever list is longer when ids missing
  if (byId.size === 0) return mapped.length >= rawFromApi.length ? mapped : rawFromApi;
  return Array.from(byId.values());
}

function cabId(cab) {
  return String(cab?.id || cab?.packageCabId || cab?.name || '').toLowerCase();
}

function isVolvoOrBusCab(cab) {
  const name = String(cab?.name || cab?.vehicleType || cab?.cabCategory || '');
  return /volvo|\bbus\b/i.test(name);
}

/**
 * For Volvo packages: keep default local cab (Alto) as primary,
 * and auto-attach Volvo bus option(s) as companion / extra cabs.
 */
export function suggestCompanionCabs(packageCabs = [], primaryCab = null) {
  const list = Array.isArray(packageCabs) ? packageCabs : [];
  if (!list.length) return [];

  const primaryId = cabId(primaryCab);
  const packageLooksVolvo = list.some(isVolvoOrBusCab);
  if (!packageLooksVolvo) return [];

  const companions = list.filter((cab) => {
    if (!cab || (cab.isActive ?? cab.is_active) === false) return false;
    if (!isVolvoOrBusCab(cab)) return false;
    if (primaryId && cabId(cab) === primaryId) return false;
    return true;
  });

  // Prefer distinct Volvo variants; cap at 2 (e.g. one-way + return)
  const seen = new Set();
  const out = [];
  for (const cab of companions) {
    const key = String(cab.name || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cab);
    if (out.length >= 2) break;
  }
  return out;
}

/** Sort: default first, then Volvo/bus, then by fare. */
export function sortPackageCabs(cabs = []) {
  return [...cabs].sort((a, b) => {
    if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
    const aBus = isVolvoOrBusCab(a) ? 0 : 1;
    const bBus = isVolvoOrBusCab(b) ? 0 : 1;
    if (aBus !== bBus) return aBus - bBus;
    if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
    return (Number(a.absoluteFare) || 0) - (Number(b.absoluteFare) || 0);
  });
}
