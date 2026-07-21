const Quotation = require('../models/Quotation');
const Lead = require('../models/Lead');
const Booking = require('../models/Booking');
const User = require('../models/User');

function addDays(date, days) {
  if (!date) return null;
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
}

function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value.label || value.name || value.title || value.value || value.key || '';
}

function normalizeVehicleType(value) {
  const normalized = textValue(value).toLowerCase().replace(/\s+/g, '_');
  if (['sedan', 'suv', 'innova', 'tempo_traveller', 'bus', 'other'].includes(normalized)) {
    return normalized;
  }
  if (normalized.includes('innova')) return 'innova';
  if (normalized.includes('tempo') || normalized.includes('traveller')) return 'tempo_traveller';
  if (normalized.includes('bus')) return 'bus';
  if (normalized.includes('sedan')) return 'sedan';
  return 'suv';
}

function mapQuoteItinerary(quotation, travelDate) {
  const snap = quotation?.packageSnapshot || {};
  const days = snap.itinerary || [];
  const selectedHotels = quotation?.selectedHotels || [];
  const selectedCabs = quotation?.selectedCabs || [];

  if (!days.length) return [];

  return days.map((d, i) => {
    const dayNum = d.day || i + 1;
    const hotelForDay = selectedHotels.find((h) => Number(h.day) === dayNum);
    const cabForDay = selectedCabs.find((cab) => Number(cab.day) === dayNum) || selectedCabs[0];
    const dayDate = travelDate ? addDays(travelDate, dayNum - 1) : null;

    const hotelName = d.accommodation || d.hotel || hotelForDay?.name || '';
    const dayHotel = hotelForDay || hotelName
      ? {
          hotelName: hotelForDay?.name || hotelName,
          destination: hotelForDay?.location || hotelForDay?.city || hotelForDay?.destination || '',
          location: hotelForDay?.location || hotelForDay?.city || '',
          roomType: textValue(hotelForDay?.room) || textValue(hotelForDay?.roomType),
          mealPlan: textValue(hotelForDay?.mealPlan),
          source: hotelForDay ? 'manual' : 'manual',
        }
      : undefined;
    const dayCab = cabForDay || d.transport
      ? {
          vehicleType: normalizeVehicleType(cabForDay?.vehicleType || cabForDay?.type || 'suv'),
          pickupLocation: cabForDay?.pickup || cabForDay?.pickupLocation || '',
          dropLocation: cabForDay?.drop || cabForDay?.dropLocation || '',
          driverName: cabForDay?.driverName || '',
          driverPhone: cabForDay?.driverPhone || '',
          vehicleNumber: cabForDay?.vehicleNumber || '',
          source: 'manual',
        }
      : undefined;

    return {
      day: dayNum,
      title: d.title || `Day ${dayNum}`,
      description: d.description || '',
      meals: d.meals || '',
      accommodation: hotelName,
      transport: d.transport || '',
      activities: d.activities || d.sightseeing || d.activityNotes || '',
      date: dayDate,
      ...(dayHotel ? { dayHotel } : {}),
      ...(dayCab ? { dayCab } : {}),
    };
  });
}

function mapQuoteHotels(quotation, travelDate) {
  const selected = quotation?.selectedHotels || [];
  if (!selected.length) {
    const snap = quotation?.packageSnapshot || {};
    return (snap.hotels || []).map((h) => ({
      hotelName: h.name || h.hotelName || '',
      externalHotelId: textValue(h.hotelId || h.id || h.uuid),
      destination: h.location || h.destination || '',
      category: h.category || '',
      roomType: textValue(h.roomType) || textValue(h.room),
      mealPlan: textValue(h.mealPlan),
      address: h.address || h.location || '',
      contactPerson: h.contactPerson || h.contact?.name || '',
      phone: h.phone || h.contact?.phone || '',
      email: h.email || h.contact?.email || '',
      rooms: Number(h.rooms) || 1,
      status: 'pending',
    }));
  }

  return selected.map((h) => {
    const checkIn = travelDate && h.day ? addDays(travelDate, Number(h.day) - 1) : h.checkIn || null;
    const nights = Number(h.nights) || 1;
    const checkOut = checkIn ? addDays(checkIn, nights) : h.checkOut || null;

    return {
      hotelName: h.name || h.hotelName || '',
      externalHotelId: textValue(h.hotelId || h.id || h.uuid),
      destination: h.location || h.city || h.destination || '',
      category: h.category || '',
      roomType: textValue(h.room) || textValue(h.roomType),
      mealPlan: textValue(h.mealPlan),
      day: h.day,
      nights,
      rooms: Number(h.rooms) || 1,
      checkIn,
      checkOut,
      address: h.address || h.location || '',
      contactPerson: h.contactPerson || h.contact?.name || '',
      phone: h.phone || h.contact?.phone || '',
      email: h.email || h.contact?.email || '',
      notes: h.externalSource ? `Source: ${h.externalSource}` : '',
      status: 'pending',
    };
  });
}

function mapQuoteTransport(quotation) {
  const selected = quotation?.selectedCabs || [];
  return selected.map((t) => ({
    vendorName: t.vendorName || t.vendor || '',
    day: Number(t.day) || undefined,
    days: Array.isArray(t.days) ? t.days.map(Number).filter(Boolean) : [],
    vehicleType: normalizeVehicleType(t.vehicleType || t.type || 'suv'),
    pickupLocation: t.pickup || t.pickupLocation || '',
    dropLocation: t.drop || t.dropLocation || '',
    driverName: t.driverName || '',
    driverPhone: t.driverPhone || '',
    contactPerson: t.contactPerson || t.contact?.name || '',
    phone: t.phone || t.contact?.phone || t.driverPhone || '',
    email: t.email || t.contact?.email || '',
    vehicleNumber: t.vehicleNumber || '',
    status: 'pending',
  }));
}

function mapQuoteActivities(quotation) {
  const selected = quotation?.selectedActivities || [];
  return selected.map((a) => ({
    name: a.name || a.title || '',
    vendorName: a.vendorName || '',
    scheduledAt: a.date || a.scheduledAt || null,
    status: 'pending',
  }));
}

async function resolveQuotationForBooking(booking) {
  if (booking.quotation) {
    const q = await Quotation.findById(booking.quotation).lean();
    if (q) return q;
  }
  if (booking.lead) {
    return Quotation.findOne({ lead: booking.lead })
      .sort({ updatedAt: -1 })
      .lean();
  }
  if (booking.quotationReference) {
    return Quotation.findOne({ quoteNumber: booking.quotationReference }).lean();
  }
  return null;
}

async function extractFulfillmentFromQuotation(quotation, booking = {}) {
  const snap = quotation?.packageSnapshot || {};
  const travelDate = booking.travelDate || null;
  let executiveName = booking.executiveName || '';

  if (!executiveName && quotation?.createdByExecutive) {
    const exec = await User.findById(quotation.createdByExecutive).select('name').lean();
    executiveName = exec?.name || '';
  }

  return {
    itinerary: mapQuoteItinerary(quotation, travelDate),
    hotels: mapQuoteHotels(quotation, travelDate),
    transport: mapQuoteTransport(quotation),
    activities: mapQuoteActivities(quotation),
    packageName: snap.name || snap.title || booking.packageName || '',
    destination: snap.destination || booking.destination || '',
    quotationReference: quotation?.quoteNumber || booking.quotationReference || '',
    executiveName,
    totalAmount: quotation?.pricing?.total || quotation?.costing?.grandTotal || booking.totalAmount,
    meta: {
      quoteNumber: quotation?.quoteNumber,
      quoteId: quotation?._id,
      quoteStatus: quotation?.status,
      packageName: snap.name || snap.title,
      inclusions: snap.inclusions || [],
      exclusions: snap.exclusions || [],
      pricing: quotation?.pricing || quotation?.costing || {},
      terms: snap.terms || snap.termsAndConditions || [],
      selectedHotels: quotation?.selectedHotels || [],
      selectedCabs: quotation?.selectedCabs || [],
    },
  };
}

async function syncBookingFromQuotation(bookingId, { force = false } = {}) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) return null;

  const quotation = await resolveQuotationForBooking(booking);
  if (!quotation) return { booking, quotation: null, synced: false };

  const extracted = await extractFulfillmentFromQuotation(quotation, booking);
  const patch = {};

  if (force || !booking.itinerary?.length) {
    if (extracted.itinerary.length) patch.itinerary = extracted.itinerary;
  }
  if (force || !booking.hotels?.length) {
    if (extracted.hotels.length) patch.hotels = extracted.hotels;
  }
  if (force || !booking.transport?.length) {
    if (extracted.transport.length) patch.transport = extracted.transport;
  }
  if (force || !booking.activities?.length) {
    if (extracted.activities.length) patch.activities = extracted.activities;
  }
  if (!booking.packageName && extracted.packageName) patch.packageName = extracted.packageName;
  if (!booking.quotationReference && extracted.quotationReference) {
    patch.quotationReference = extracted.quotationReference;
  }
  if (!booking.quotation && quotation._id) patch.quotation = quotation._id;
  if (!booking.executiveName && extracted.executiveName) patch.executiveName = extracted.executiveName;

  let updated = booking;
  if (Object.keys(patch).length) {
    updated = await Booking.findByIdAndUpdate(bookingId, patch, { new: true }).lean();
  }

  return {
    booking: updated,
    quotation,
    quotationPreview: extracted,
    synced: Object.keys(patch).length > 0,
  };
}

async function enrichBookingWithQuotation(booking) {
  const quotation = await resolveQuotationForBooking(booking);
  if (!quotation) return booking;

  const preview = await extractFulfillmentFromQuotation(quotation, booking);
  const needsAutoSync =
    !booking.itinerary?.length ||
    !booking.hotels?.length ||
    (!booking.transport?.length && preview.transport.length > 0);

  if (needsAutoSync) {
    const result = await syncBookingFromQuotation(booking._id, { force: false });
    if (result?.booking) {
      return {
        ...result.booking,
        quotationPreview: result.quotationPreview,
        quotationMeta: result.quotationPreview?.meta,
        autoSyncedFromQuotation: result.synced,
      };
    }
  }

  return {
    ...booking,
    quotationPreview: preview,
    quotationMeta: preview.meta,
  };
}

module.exports = {
  mapQuoteItinerary,
  mapQuoteHotels,
  mapQuoteTransport,
  mapQuoteActivities,
  extractFulfillmentFromQuotation,
  syncBookingFromQuotation,
  enrichBookingWithQuotation,
  resolveQuotationForBooking,
};
