import { expandDestinationMatchTerms } from '../../lib/destinationFamilies';

/**
 * Quotation costing formula (single source of truth):
 * 1. Sum raw costs (hotel + cab + activities + package residual + flights) — NO margin on lines
 * 2. Apply admin destination margin % once on that total
 * 3. Optional executive "Your margin %" on after-admin total
 * 4. Discount → GST → final
 */
export function calculatePricing({
  baseCost = 0,
  hotelCost = 0,
  cabCost = 0,
  flightCost = 0,
  activityCost = 0,
  taxes = 0,
  markup = 0,
  discount = 0,
  gstEnabled = false,
  markupPercent = 0,
  adminMarginPercent = 0,
} = {}) {
  const costs =
    Number(baseCost || 0) +
    Number(hotelCost || 0) +
    Number(cabCost || 0) +
    Number(flightCost || 0) +
    Number(activityCost || 0);

  // Admin destination margin — once on cost total only (never on hotel/cab lines)
  const adminPct = Math.max(0, Number(adminMarginPercent) || 0);
  const adminMarkup =
    adminPct > 0 ? Math.round(costs * (adminPct / 100) * 100) / 100 : 0;
  const afterAdmin = costs + adminMarkup;

  // Executive margin — optional, on top of admin-adjusted total
  const execPct = Math.max(0, Number(markupPercent) || 0);
  const execMarkup =
    execPct > 0
      ? Math.round(afterAdmin * (execPct / 100) * 100) / 100
      : Math.max(0, Number(markup) || 0);

  const computedMarkup = adminMarkup + execMarkup;
  const disc = Math.max(0, Number(discount) || 0);
  const packageBeforeDisc = afterAdmin + execMarkup;
  const packageCost = Math.max(0, packageBeforeDisc - disc);
  const computedTaxes = gstEnabled
    ? Math.round(packageCost * 0.05 * 100) / 100
    : 0;

  const total = Math.max(0, packageCost + computedTaxes);
  const listWithGst = gstEnabled
    ? Math.round(packageBeforeDisc * 0.05 * 100) / 100 + packageBeforeDisc
    : packageBeforeDisc;
  const youSave = disc;
  const profit = computedMarkup - disc;
  const profitMargin = total > 0 ? Math.round((profit / total) * 1000) / 10 : 0;

  return {
    subtotal: listWithGst,
    total,
    profitMargin,
    taxes: computedTaxes,
    markup: computedMarkup,
    adminMarkup,
    execMarkup,
    packageCost,
    packageBeforeDisc,
    youSave,
    costsBeforeMargin: costs,
  };
}

/**
 * Keep hotel / cab / residual as separate raw cost buckets.
 * Do NOT fold residual into hotel — that made Hotel Cost look "margined".
 */
export function foldPackageResidualIntoHotel(pricing = {}) {
  return {
    ...pricing,
    hotelCost: Math.round(Number(pricing.hotelCost || 0) * 100) / 100,
    baseCost: Math.round(Number(pricing.baseCost || 0) * 100) / 100,
    flightCost: Math.round(Number(pricing.flightCost || 0) * 100) / 100,
  };
}

/**
 * Customer-facing costing rows:
 * Hotel + Cab + Activities (+ Package inclusions if residual) → Subtotal → margins → Final
 * Admin margin is applied in calculatePricing on the sum only.
 */
export function getDisplayedCostBreakdown(pricing = {}) {
  const calc = calculatePricing(pricing);
  const hotelCost = Number(pricing.hotelCost || 0);
  const transportCost = Number(pricing.cabCost || 0);
  const activityCost = Number(pricing.activityCost || 0);
  const packageInclusions =
    Math.round(
      (Number(pricing.baseCost || 0) + Number(pricing.flightCost || 0)) * 100
    ) / 100;

  return {
    hotelCost,
    transportCost,
    activityCost,
    packageInclusions,
    markup: calc.execMarkup,
    adminMarkup: calc.adminMarkup,
    taxes: calc.taxes,
    discount: Math.max(0, Number(pricing.discount || 0)),
    youSave: calc.youSave,
    packageCost: calc.packageCost,
    subtotalBeforeDiscount: calc.subtotal,
    finalTotal: calc.total,
    costsBeforeMargin: calc.costsBeforeMargin,
    adminMarginPercent: Math.max(0, Number(pricing.adminMarginPercent) || 0),
  };
}

export function formatINR(n, { zeroLabel } = {}) {
  const value = Number(n || 0);
  if (value === 0 && zeroLabel) return zeroLabel;
  return `₹${value.toLocaleString('en-IN')}`;
}

/** Discount as % of package before discount (costs + admin + exec margins). */
export function getDiscountPercent(pricing = {}) {
  const discount = Math.max(0, Number(pricing.discount) || 0);
  if (discount <= 0) return 0;
  const calc = calculatePricing(pricing);
  const packageBeforeDisc = Number(calc.packageBeforeDisc) || 0;
  if (packageBeforeDisc <= 0) return 0;
  return Math.round((discount / packageBeforeDisc) * 1000) / 10;
}

export function formatDiscountLabel(pricingOrSummary) {
  if (!pricingOrSummary) return '0%';
  const pct =
    pricingOrSummary.discountPercent != null
      ? Number(pricingOrSummary.discountPercent)
      : getDiscountPercent(pricingOrSummary);
  const amount = Number(pricingOrSummary.discount || 0);
  if (pct <= 0 && amount <= 0) return '0%';
  if (amount > 0) return `${pct}% (₹${amount.toLocaleString('en-IN')})`;
  return `${pct}%`;
}

export function getPackageTypeConfig(type) {
  const types = {
    honeymoon: { label: 'Honeymoon', color: 'rose' },
    family: { label: 'Family', color: 'sky' },
    group: { label: 'Group', color: 'violet' },
    adventure: { label: 'Adventure', color: 'emerald' },
    luxury: { label: 'Luxury', color: 'amber' },
    corporate: { label: 'Corporate', color: 'slate' },
  };
  return types[type] || { label: type, color: 'brand' };
}

export function defaultItineraryDay(day, destination) {
  return {
    id: `day-${Date.now()}-${day}`,
    day,
    title: day === 1 ? `Arrival in ${destination}` : `Day ${day} in ${destination}`,
    description: '',
    hotel: '',
    activities: '',
    meals: 'Breakfast',
    transport: 'Private Cab',
  };
}

export const defaultPricing = {
  baseCost: 0,
  hotelCost: 0,
  cabCost: 0,
  flightCost: 0,
  activityCost: 0,
  taxes: 0,
  gstEnabled: false,
  markup: 0,
  markupPercent: 0,
  adminMarginPercent: 0,
  discount: 0,
  total: 0,
  profitMargin: 0,
};

export const defaultWizardState = {
  leadId: '',
  packageId: '',
  customizations: '',
  selectedHotelIds: [],
  selectedCabIds: [],
  selectedFlightIds: [],
  selectedActivityIds: [],
  activitiesSkipped: false,
  pricing: { ...defaultPricing },
};

export function matchesResourceDestination(resource = {}, destination = '') {
  const text = String(destination || '').trim();
  if (!text) return true;

  const resourceDestination = String(
    resource.destination || resource.destinationName || resource.destination_name || resource.destination_city || ''
  ).trim();
  const resourceState = String(resource.state || resource.destination_state || '').trim();
  if (!resourceDestination && !resourceState) return true;

  const normalize = (value) =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const terms = expandDestinationMatchTerms(text);
  const haystack = normalize(
    [resourceDestination, resourceState, resource.name, resource.destinationName]
      .filter(Boolean)
      .join(' ')
  );
  if (!haystack) return false;

  return terms.some((term) => {
    if (haystack.includes(term) || term.includes(haystack)) return true;
    const cityToken = term.split(' ')[0];
    return cityToken.length >= 3 && haystack.includes(cityToken);
  });
}
