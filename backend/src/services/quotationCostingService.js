function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveUnitPrice(item = {}) {
  // Prefer line total / explicit cost. Never use catalog startingPrice — package base already includes it.
  if (item.total != null && item.total !== '' && Number.isFinite(Number(item.total))) {
    return toNumber(item.total);
  }
  return toNumber(
    item.sellPrice ??
      item.price ??
      item.cost ??
      item.amount ??
      item.unitPrice ??
      item.priceDelta ??
      item.perNight ??
      0
  );
}

function buildLineItems({ packageSnapshot, selectedHotels, selectedCabs, selectedFlights, selectedActivities }) {
  const lines = [];

  if (packageSnapshot) {
    lines.push({
      category: 'package',
      label: packageSnapshot.name || 'Base Package',
      quantity: 1,
      unitPrice: resolveUnitPrice(packageSnapshot),
    });
  }

  (selectedHotels || []).forEach((item) => {
    lines.push({
      category: 'hotel',
      label: item.name || item.snapshot?.name || 'Hotel',
      quantity: 1,
      unitPrice: resolveUnitPrice(item),
    });
  });

  (selectedCabs || []).forEach((item) => {
    lines.push({
      category: 'cab',
      label: item.vehicleType || item.snapshot?.vehicleType || 'Cab',
      quantity: 1,
      unitPrice: resolveUnitPrice(item),
    });
  });

  (selectedFlights || []).forEach((item) => {
    lines.push({
      category: 'flight',
      label: item.flightNumber || item.airline || 'Flight',
      quantity: 1,
      unitPrice: resolveUnitPrice(item),
    });
  });

  (selectedActivities || []).forEach((item) => {
    lines.push({
      category: 'activity',
      label: item.name || item.snapshot?.name || 'Activity',
      quantity: toNumber(item.quantity) || 1,
      unitPrice: resolveUnitPrice(item),
    });
  });

  return lines;
}

function calculateQuotationPricing({
  packageSnapshot = null,
  selectedHotels = [],
  selectedCabs = [],
  selectedFlights = [],
  selectedActivities = [],
  pricingInput = {},
}) {
  const lineItems = buildLineItems({
    packageSnapshot,
    selectedHotels,
    selectedCabs,
    selectedFlights,
    selectedActivities,
  });

  const categoryTotals = lineItems.reduce(
    (acc, line) => {
      const total = toNumber(line.quantity) * toNumber(line.unitPrice);
      acc.subtotal += total;
      if (line.category === 'package') acc.baseCost += total;
      if (line.category === 'hotel') acc.hotelCost += total;
      if (line.category === 'cab') acc.cabCost += total;
      if (line.category === 'flight') acc.flightCost += total;
      if (line.category === 'activity') acc.activityCost += total;
      return acc;
    },
    { subtotal: 0, baseCost: 0, hotelCost: 0, cabCost: 0, flightCost: 0, activityCost: 0 }
  );

  const markupInput = toNumber(pricingInput.markup);
  const markupPercent = toNumber(pricingInput.markupPercent);
  const companyMarginBaked = Boolean(pricingInput.companyMarginBaked);
  const adminMarginPercent = companyMarginBaked
    ? 0
    : toNumber(pricingInput.adminMarginPercent);
  const discount = toNumber(pricingInput.discount);
  const gstEnabled = Boolean(pricingInput.gstEnabled);

  // Raw cost sum only — company margin is either baked into lines or applied once below
  const costs =
    categoryTotals.baseCost +
    categoryTotals.hotelCost +
    categoryTotals.cabCost +
    categoryTotals.flightCost +
    categoryTotals.activityCost;

  // Admin margin once on total costs (skipped when already baked into hotel/cab lines)
  const adminMarkup =
    adminMarginPercent > 0
      ? Math.round(costs * (adminMarginPercent / 100) * 100) / 100
      : 0;
  const afterAdmin = costs + adminMarkup;
  const execMarkup =
    markupPercent > 0
      ? Math.round(afterAdmin * (markupPercent / 100) * 100) / 100
      : markupInput;
  const markup = adminMarkup + execMarkup;
  const packageCost = Math.max(0, afterAdmin + execMarkup - discount);
  const taxes = gstEnabled ? Math.round(packageCost * 0.05 * 100) / 100 : 0;
  const total = Math.max(0, packageCost + taxes);
  const profitAmount = markup - discount;
  const profitMargin = total > 0 ? Math.round((profitAmount / total) * 1000) / 10 : 0;

  return {
    pricing: {
      baseCost: categoryTotals.baseCost,
      hotelCost: categoryTotals.hotelCost,
      cabCost: categoryTotals.cabCost,
      flightCost: categoryTotals.flightCost,
      activityCost: categoryTotals.activityCost,
      taxes,
      gstEnabled,
      markup,
      markupPercent,
      adminMarginPercent: companyMarginBaked
        ? toNumber(pricingInput.companyMarginBakedPercent)
        : adminMarginPercent,
      companyMarginBaked,
      companyMarginBakedPercent: toNumber(pricingInput.companyMarginBakedPercent),
      discount,
      total,
      profitMargin,
    },
    costing: {
      lineItems: lineItems.map((line) => ({
        ...line,
        lineTotal: toNumber(line.quantity) * toNumber(line.unitPrice),
      })),
      subtotal: categoryTotals.subtotal,
      taxes,
      gstEnabled,
      markup,
      markupPercent,
      adminMarginPercent: companyMarginBaked
        ? toNumber(pricingInput.companyMarginBakedPercent)
        : adminMarginPercent,
      companyMarginBaked,
      discount,
      grandTotal: total,
      profitMargin,
    },
  };
}

module.exports = {
  calculateQuotationPricing,
};
