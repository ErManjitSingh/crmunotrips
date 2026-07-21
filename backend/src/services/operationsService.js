const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Vendor = require('../models/Vendor');
const Activity = require('../models/Activity');
const Voucher = require('../models/Voucher');
const SupportTicket = require('../models/SupportTicket');
const Hotel = require('../models/Hotel');
const Cab = require('../models/Cab');
const Flight = require('../models/Flight');
const TripTask = require('../models/TripTask');
const TripDocument = require('../models/TripDocument');
const Payment = require('../models/Payment');
const Quotation = require('../models/Quotation');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { withBranch } = require('../utils/branchScope');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { createOperationsTasksForBooking } = require('./operationsAutomationService');
const {
  mapQuoteItinerary,
  mapQuoteHotels,
  mapQuoteTransport,
  mapQuoteActivities,
} = require('./operationsQuotationSyncService');
const { notifyBookingConfirmed } = require('./notificationService');
const cacheService = require('./cacheService');

const OPS_DASHBOARD_TTL = 30_000;

const STATUS_ROUTE_MAP = {
  pending: ['booking_received', 'pending_verification', 'pending'],
  confirmed: ['confirmed'],
  active: ['in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  refund: ['refund_pending', 'refund_completed'],
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function resolveStatusFilter(statusKey) {
  if (!statusKey) return null;
  return STATUS_ROUTE_MAP[statusKey] || [statusKey];
}

function notArchivedFilter() {
  return { archivedAt: { $exists: false } };
}

function pctChangeLabel(current, previous) {
  if (!previous && !current) return { change: 'No change', changeType: 'neutral' };
  if (!previous && current) return { change: '↑ 100%', changeType: 'up' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { change: 'No change', changeType: 'neutral' };
  return pct > 0
    ? { change: `↑ ${Math.abs(pct)}%`, changeType: 'up' }
    : { change: `↓ ${Math.abs(pct)}%`, changeType: 'down' };
}

function rollingWeekRange(weeksAgo = 0) {
  const end = endOfDay();
  end.setDate(end.getDate() - weeksAgo * 7);
  const start = startOfDay(end);
  start.setDate(start.getDate() - 6);
  return { start, end };
}

async function dailyBookingCounts(filterBuilder, days = 7) {
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    series.push(await Booking.countDocuments(filterBuilder(startOfDay(d), endOfDay(d))));
  }
  return series;
}

async function buildOpsSparklines(base, pendingHotel, pendingCab, pendingActivity, pendingVoucher) {
  const defs = {
    todaysArrivals: (start, end) => ({ ...base, travelDate: { $gte: start, $lte: end } }),
    todaysDepartures: (start, end) => ({ ...base, returnDate: { $gte: start, $lte: end } }),
    upcomingTours: (start, end) => ({
      ...base,
      createdAt: { $gte: start, $lte: end },
      travelDate: { $gt: end },
      status: { $in: ['confirmed', 'in_progress', 'booking_received', 'pending_verification'] },
    }),
    pendingBookings: (start, end) => ({
      ...base,
      createdAt: { $gte: start, $lte: end },
      status: { $in: STATUS_ROUTE_MAP.pending },
    }),
    hotelPending: (start, end) => ({ ...pendingHotel, updatedAt: { $gte: start, $lte: end } }),
    cabPending: (start, end) => ({ ...pendingCab, updatedAt: { $gte: start, $lte: end } }),
    activityPending: (start, end) => ({ ...pendingActivity, updatedAt: { $gte: start, $lte: end } }),
    voucherPending: (start, end) => ({ ...pendingVoucher, updatedAt: { $gte: start, $lte: end } }),
    activeTrips: (start, end) => ({
      ...base,
      status: 'in_progress',
      updatedAt: { $gte: start, $lte: end },
    }),
    completedTrips: (start, end) => ({
      ...base,
      status: 'completed',
      updatedAt: { $gte: start, $lte: end },
    }),
  };
  const keys = Object.keys(defs);
  const series = await Promise.all(keys.map((key) => dailyBookingCounts(defs[key])));
  return Object.fromEntries(keys.map((key, i) => [key, series[i]]));
}

function mapStatusToCategory(status) {
  if (STATUS_ROUTE_MAP.pending.includes(status)) return 'pending';
  if (STATUS_ROUTE_MAP.confirmed.includes(status)) return 'confirmed';
  if (STATUS_ROUTE_MAP.active.includes(status)) return 'active';
  if (STATUS_ROUTE_MAP.completed.includes(status)) return 'completed';
  return null;
}

async function nextBookingNumber() {
  const year = new Date().getFullYear();
  const count = await Booking.countDocuments({
    bookingNumber: new RegExp(`^BK-${year}-`),
  });
  return `BK-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function buildDashboard(branchId) {
  const base = withBranch(notArchivedFilter(), branchId);
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const tomorrowEnd = endOfDay(new Date(Date.now() + 86400000));

  const pendingHotel = {
    ...base,
    $or: [{ hotelConfirmation: 'pending' }, { 'hotels.status': { $in: ['pending', 'requested'] } }],
  };
  const pendingCab = {
    ...base,
    $or: [{ cabConfirmation: 'pending' }, { 'transport.status': { $in: ['pending', 'requested'] } }],
  };
  const pendingActivity = {
    ...base,
    'activities.status': { $in: ['pending'] },
  };
  const pendingVoucher = { ...base, voucherStatus: 'pending' };

  const [
    todaysArrivals,
    todaysDepartures,
    upcomingTours,
    pendingBookings,
    hotelPending,
    cabPending,
    activityPending,
    voucherPending,
    activeTrips,
    completedTrips,
    openTickets,
    totalBookings,
    branchStats,
    recentBookings,
    pendingTasks,
    pendingConfirmations,
    openTicketsList,
  ] = await Promise.all([
    Booking.countDocuments({ ...base, travelDate: { $gte: todayStart, $lte: todayEnd } }),
    Booking.countDocuments({ ...base, returnDate: { $gte: todayStart, $lte: todayEnd } }),
    Booking.countDocuments({
      ...base,
      travelDate: { $gt: todayEnd },
      status: { $in: ['confirmed', 'in_progress', 'booking_received', 'pending_verification'] },
    }),
    Booking.countDocuments({
      ...base,
      status: { $in: STATUS_ROUTE_MAP.pending },
    }),
    Booking.countDocuments(pendingHotel),
    Booking.countDocuments(pendingCab),
    Booking.countDocuments(pendingActivity),
    Booking.countDocuments(pendingVoucher),
    Booking.countDocuments({ ...base, status: 'in_progress' }),
    Booking.countDocuments({ ...base, status: 'completed' }),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    Booking.countDocuments(base),
    Booking.aggregate([
      { $match: base },
      { $group: { _id: '$branchId', count: { $sum: 1 } } },
    ]),
    Booking.find(base).sort({ createdAt: -1 }).limit(8).select(
      'bookingNumber customerName destination travelDate returnDate status totalAmount hotelConfirmation cabConfirmation'
    ).lean(),
    TripTask.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
    Booking.find({
      ...base,
      status: { $in: STATUS_ROUTE_MAP.pending },
      $or: [{ hotelConfirmation: 'pending' }, { cabConfirmation: 'pending' }],
    })
      .sort({ travelDate: 1 })
      .limit(8)
      .select('bookingNumber customerName destination hotelConfirmation cabConfirmation travelDate')
      .lean(),
    SupportTicket.find({ status: { $in: ['open', 'in_progress'] } })
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean(),
  ]);

  const tripsStartingTomorrow = await Booking.countDocuments({
    ...base,
    travelDate: { $gt: todayEnd, $lte: tomorrowEnd },
    status: { $in: ['confirmed', 'in_progress', 'booking_received'] },
  });

  const thisWeek = rollingWeekRange(0);
  const lastWeek = rollingWeekRange(1);

  const [
    statusBreakdown,
    guestsOnTripAgg,
    branchDocs,
    trendUpcomingThis,
    trendUpcomingLast,
    trendPendingThis,
    trendPendingLast,
    trendHotelThis,
    trendHotelLast,
    trendCabThis,
    trendCabLast,
    trendActivityThis,
    trendActivityLast,
    trendVoucherThis,
    trendVoucherLast,
    trendActiveThis,
    trendActiveLast,
    trendCompletedThis,
    trendCompletedLast,
    sparklines,
  ] = await Promise.all([
    Booking.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { ...base, status: 'in_progress' } },
      {
        $group: {
          _id: null,
          guests: { $sum: { $add: [{ $ifNull: ['$adults', 0] }, { $ifNull: ['$children', 0] }] } },
          bookings: { $sum: 1 },
        },
      },
    ]),
    Branch.find({}).select('name code').lean(),
    Booking.countDocuments({
      ...base,
      travelDate: { $gt: todayEnd, $lte: thisWeek.end },
      status: { $in: ['confirmed', 'in_progress', 'booking_received', 'pending_verification'] },
    }),
    Booking.countDocuments({
      ...base,
      travelDate: { $gt: lastWeek.end, $lte: lastWeek.end },
      status: { $in: ['confirmed', 'in_progress', 'booking_received', 'pending_verification'] },
    }),
    Booking.countDocuments({ ...base, status: { $in: STATUS_ROUTE_MAP.pending }, createdAt: { $gte: thisWeek.start, $lte: thisWeek.end } }),
    Booking.countDocuments({ ...base, status: { $in: STATUS_ROUTE_MAP.pending }, createdAt: { $gte: lastWeek.start, $lte: lastWeek.end } }),
    Booking.countDocuments({ ...pendingHotel, updatedAt: { $gte: thisWeek.start, $lte: thisWeek.end } }),
    Booking.countDocuments({ ...pendingHotel, updatedAt: { $gte: lastWeek.start, $lte: lastWeek.end } }),
    Booking.countDocuments({ ...pendingCab, updatedAt: { $gte: thisWeek.start, $lte: thisWeek.end } }),
    Booking.countDocuments({ ...pendingCab, updatedAt: { $gte: lastWeek.start, $lte: lastWeek.end } }),
    Booking.countDocuments({ ...pendingActivity, updatedAt: { $gte: thisWeek.start, $lte: thisWeek.end } }),
    Booking.countDocuments({ ...pendingActivity, updatedAt: { $gte: lastWeek.start, $lte: lastWeek.end } }),
    Booking.countDocuments({ ...pendingVoucher, updatedAt: { $gte: thisWeek.start, $lte: thisWeek.end } }),
    Booking.countDocuments({ ...pendingVoucher, updatedAt: { $gte: lastWeek.start, $lte: lastWeek.end } }),
    Booking.countDocuments({ ...base, status: 'in_progress', updatedAt: { $gte: thisWeek.start, $lte: thisWeek.end } }),
    Booking.countDocuments({ ...base, status: 'in_progress', updatedAt: { $gte: lastWeek.start, $lte: lastWeek.end } }),
    Booking.countDocuments({ ...base, status: 'completed', updatedAt: { $gte: thisWeek.start, $lte: thisWeek.end } }),
    Booking.countDocuments({ ...base, status: 'completed', updatedAt: { $gte: lastWeek.start, $lte: lastWeek.end } }),
    buildOpsSparklines(base, pendingHotel, pendingCab, pendingActivity, pendingVoucher),
  ]);

  const branchMap = Object.fromEntries(branchDocs.map((b) => [String(b._id), b.name]));
  const enrichedBranchStats = branchStats
    .map((b) => ({
      id: b._id,
      name: branchMap[String(b._id)] || 'Unassigned',
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count);

  const bookingsByStatus = { pending: 0, confirmed: 0, active: 0, completed: 0 };
  statusBreakdown.forEach((row) => {
    const cat = mapStatusToCategory(row._id);
    if (cat) bookingsByStatus[cat] += row.count;
  });

  const guestsOnTrip = guestsOnTripAgg[0] || { guests: 0, bookings: 0 };

  const kpiTrends = {
    todaysArrivals: pctChangeLabel(todaysArrivals, 0),
    todaysDepartures: pctChangeLabel(todaysDepartures, 0),
    upcomingTours: pctChangeLabel(trendUpcomingThis, trendUpcomingLast),
    pendingBookings: pctChangeLabel(trendPendingThis, trendPendingLast),
    hotelPending: pctChangeLabel(trendHotelThis, trendHotelLast),
    cabPending: pctChangeLabel(trendCabThis, trendCabLast),
    activityPending: pctChangeLabel(trendActivityThis, trendActivityLast),
    voucherPending: pctChangeLabel(trendVoucherThis, trendVoucherLast),
    activeTrips: pctChangeLabel(trendActiveThis, trendActiveLast),
    completedTrips: pctChangeLabel(trendCompletedThis, trendCompletedLast),
  };

  return {
    kpis: {
      todaysArrivals,
      todaysDepartures,
      upcomingTours,
      pendingBookings,
      hotelPending,
      cabPending,
      activityPending,
      voucherPending,
      hotelConfirmations: hotelPending,
      cabConfirmations: cabPending,
      activeTrips,
      completedTrips,
      totalActiveTrips: activeTrips,
      openTickets,
      totalBookings,
      pendingConfirmations: hotelPending + cabPending,
      pendingTasks,
      tripsStartingTomorrow,
      guestsOnTrip: guestsOnTrip.guests,
      onTripBookings: guestsOnTrip.bookings,
    },
    hubStats: {
      onTrip: activeTrips,
      onTripGuests: guestsOnTrip.guests,
      onTripBookings: guestsOnTrip.bookings,
      departuresToday: todaysDepartures,
      arrivalsToday: todaysArrivals,
    },
    kpiTrends,
    sparklines,
    branchStats: enrichedBranchStats,
    bookingsByStatus: [
      { status: 'confirmed', label: 'Confirmed', count: bookingsByStatus.confirmed },
      { status: 'pending', label: 'Pending', count: bookingsByStatus.pending },
      { status: 'active', label: 'Active', count: bookingsByStatus.active },
      { status: 'completed', label: 'Completed', count: bookingsByStatus.completed },
    ],
    todaySchedule: {
      arrivals: {
        count: todaysArrivals,
        subtitle: todaysArrivals ? `${todaysArrivals} arrival${todaysArrivals === 1 ? '' : 's'} today` : 'No arrivals today',
      },
      departures: {
        count: todaysDepartures,
        subtitle: todaysDepartures ? `${todaysDepartures} departure${todaysDepartures === 1 ? '' : 's'} today` : 'No departures today',
      },
      guestsOnTrip: {
        count: guestsOnTrip.guests,
        bookings: guestsOnTrip.bookings,
        subtitle: guestsOnTrip.bookings
          ? `Across ${guestsOnTrip.bookings} booking${guestsOnTrip.bookings === 1 ? '' : 's'}`
          : 'No guests on trip',
      },
      pendingTasks: {
        count: pendingTasks,
        subtitle: pendingTasks ? 'Need immediate attention' : 'All tasks clear',
      },
    },
    recentBookings,
    pendingConfirmations,
    openTickets: openTicketsList,
    upcomingTrips: await Booking.find({
      ...base,
      travelDate: { $gte: todayStart },
      status: { $nin: ['cancelled', 'completed', 'refund_completed'] },
    })
      .sort({ travelDate: 1 })
      .limit(10)
      .select('bookingNumber customerName destination travelDate returnDate status')
      .lean(),
  };
}

async function getDashboard(branchId) {
  const key = `ops:dashboard:${branchId || 'all'}`;
  return cacheService.getOrSet(key, () => buildDashboard(branchId), OPS_DASHBOARD_TTL);
}

async function aggregateBookingSummary(filter) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const [row] = await Booking.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
        totalPax: {
          $sum: {
            $add: [{ $ifNull: ['$adults', 0] }, { $ifNull: ['$children', 0] }],
          },
        },
        hotelsConfirmed: {
          $sum: { $cond: [{ $eq: ['$hotelConfirmation', 'confirmed'] }, 1, 0] },
        },
        cabsConfirmed: {
          $sum: { $cond: [{ $eq: ['$cabConfirmation', 'confirmed'] }, 1, 0] },
        },
        hotelsPending: {
          $sum: { $cond: [{ $eq: ['$hotelConfirmation', 'pending'] }, 1, 0] },
        },
        cabsPending: {
          $sum: { $cond: [{ $eq: ['$cabConfirmation', 'pending'] }, 1, 0] },
        },
        todayOnTrip: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$travelDate', todayStart] },
                  { $lte: ['$travelDate', todayEnd] },
                ],
              },
              1,
              0,
            ],
          },
        },
        returningToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$returnDate', todayStart] },
                  { $lte: ['$returnDate', todayEnd] },
                ],
              },
              1,
              0,
            ],
          },
        },
        completedThisMonth: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$returnDate', new Date(new Date().getFullYear(), new Date().getMonth(), 1)] },
                  { $lte: ['$returnDate', todayEnd] },
                ],
              },
              1,
              0,
            ],
          },
        },
        vouchersIssued: {
          $sum: {
            $cond: [
              { $in: ['$voucherStatus', ['issued', 'sent', 'redeemed']] },
              1,
              0,
            ],
          },
        },
        vouchersRedeemed: {
          $sum: { $cond: [{ $eq: ['$voucherStatus', 'redeemed'] }, 1, 0] },
        },
        paidInFull: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] },
        },
      },
    },
  ]);

  return row || {
    count: 0,
    totalAmount: 0,
    totalPax: 0,
    todayPending: 0,
    hotelsConfirmed: 0,
    cabsConfirmed: 0,
    hotelsPending: 0,
    cabsPending: 0,
    todayOnTrip: 0,
    returningToday: 0,
    completedThisMonth: 0,
    vouchersIssued: 0,
    vouchersRedeemed: 0,
    paidInFull: 0,
  };
}

async function aggregateHotelSummary(filter = {}) {
  const [row] = await Hotel.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        partnerHotels: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        categories: { $addToSet: '$category' },
        destinations: { $addToSet: '$destination' },
      },
    },
  ]);

  return {
    count: row?.count || 0,
    partnerHotels: row?.partnerHotels || 0,
    topCategories: (row?.categories || []).filter(Boolean).length,
    destinations: (row?.destinations || []).filter(Boolean).length,
  };
}

function mapHotelRow(hotel) {
  const room = hotel.roomTypes?.[0];
  const contract = hotel.contractRates?.[0];
  const idSuffix = String(hotel._id || '').slice(-4);
  const codeNum = Number.parseInt(idSuffix, 16) % 10000;

  return {
    ...hotel,
    displayCode: `HTL-${String(Number.isNaN(codeNum) ? 0 : codeNum).padStart(4, '0')}`,
    displayRoomType: hotel.roomType || room?.name || 'Standard',
    displayMealPlan: hotel.mealPlan || contract?.mealPlan || 'CP (Breakfast)',
    displayPrice: hotel.price ?? room?.baseRate ?? contract?.rate ?? 0,
    displayCity: hotel.destination || hotel.location?.split(',')[0] || hotel.location,
  };
}

async function listHotels(query = {}, { branchId } = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 10, maxLimit: 100 });
  const filter = withBranch({}, branchId);

  if (query.category?.trim()) {
    filter.category = { $regex: query.category.trim(), $options: 'i' };
  }
  if (query.location?.trim()) {
    filter.location = { $regex: query.location.trim(), $options: 'i' };
  }
  if (query.roomType?.trim()) {
    filter.$or = [
      { roomType: { $regex: query.roomType.trim(), $options: 'i' } },
      { 'roomTypes.name': { $regex: query.roomType.trim(), $options: 'i' } },
    ];
  }
  if (query.mealPlan?.trim()) {
    filter.mealPlan = { $regex: query.mealPlan.trim(), $options: 'i' };
  }
  if (query.destination?.trim()) {
    filter.destination = { $regex: query.destination.trim(), $options: 'i' };
  }
  if (query.status?.trim()) {
    filter.status = query.status.trim();
  }

  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
      { destination: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
      { roomType: { $regex: q, $options: 'i' } },
      { mealPlan: { $regex: q, $options: 'i' } },
    ];
  }

  const baseFilter = withBranch({}, branchId);
  const [rows, total, summary, categories, locations, roomTypes, mealPlans] = await Promise.all([
    Hotel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Hotel.countDocuments(filter),
    aggregateHotelSummary(filter),
    Hotel.distinct('category', baseFilter),
    Hotel.distinct('location', baseFilter),
    Hotel.distinct('roomType', { ...baseFilter, roomType: { $nin: [null, ''] } }),
    Hotel.distinct('mealPlan', { ...baseFilter, mealPlan: { $nin: [null, ''] } }),
  ]);

  const roomTypeNames = await Hotel.distinct('roomTypes.name', baseFilter);

  return {
    ...paginatedResponse(rows.map(mapHotelRow), { page, limit, total }),
    summary,
    filters: {
      categories: categories.filter(Boolean).sort(),
      locations: locations.filter(Boolean).sort(),
      roomTypes: [...new Set([...roomTypes, ...roomTypeNames].filter(Boolean))].sort(),
      mealPlans: mealPlans.filter(Boolean).sort(),
    },
  };
}

const FLEET_STATUS_META = {
  available: { label: 'Available', color: '#22C55E' },
  on_trip: { label: 'On Trip', color: '#3B82F6' },
  maintenance: { label: 'Maintenance', color: '#F97316' },
  unavailable: { label: 'Unavailable', color: '#94A3B8' },
};

function formatCabTypeLabel(vehicleType = '') {
  const lower = String(vehicleType).toLowerCase();
  if (lower.includes('suv') || lower.includes('innova') || lower.includes('ertiga') || lower.includes('crysta')) {
    return 'SUV';
  }
  if (lower.includes('sedan')) return 'Sedan';
  if (lower.includes('hatch')) return 'Hatchback';
  if (lower.includes('tempo') || lower.includes('traveller')) return 'Tempo Traveller';
  return vehicleType ? vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1) : 'SUV';
}

function mapCabRow(cab) {
  const vehicleName = cab.vehicleName
    || (cab.vehicleType
      ? cab.vehicleType.charAt(0).toUpperCase() + cab.vehicleType.slice(1)
      : 'Vehicle');
  const idSuffix = String(cab._id || '').slice(-6);
  const regNum = Number.parseInt(idSuffix, 16) % 10000;
  const registrationNumber = cab.registrationNumber
    || `KA 01 AB ${String(Number.isNaN(regNum) ? 1234 : regNum).padStart(4, '0')}`;

  return {
    ...cab,
    displayName: vehicleName,
    displayType: formatCabTypeLabel(cab.vehicleType),
    displayRegistration: registrationNumber,
    displaySubtitle: [cab.color, cab.fuelType].filter(Boolean).join(' • ') || 'White • Diesel',
    displayCapacity: cab.capacity ? `${cab.capacity} Seats + Driver` : '6 Seats + Driver',
    displayPickup: cab.pickupLocation,
    displayDrop: cab.dropLocation,
    displayPickupAddress: cab.pickupAddress || '',
    displayDropAddress: cab.dropAddress || '',
    displayTripType: cab.tripType || 'One Way',
    displayCost: cab.cost ?? 0,
    displayStatus: cab.status || 'available',
  };
}

function mapFlightRow(flight) {
  return {
    ...flight,
    displayRoute: `${flight.departure || '—'} → ${flight.arrival || '—'}`,
    displayCost: flight.cost ?? 0,
    displayStatus: flight.status || 'available',
  };
}

async function aggregateTransportSummary({ branchId } = {}) {
  const cabFilter = withBranch({}, branchId);
  const flightFilter = withBranch({}, branchId);
  const bookingFilter = withBranch(notArchivedFilter(), branchId);
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const [
    totalVehicles,
    totalFlights,
    todaysBookings,
    weekCostRow,
    fleetRows,
    mostUsedRows,
  ] = await Promise.all([
    Cab.countDocuments(cabFilter),
    Flight.countDocuments(flightFilter),
    Booking.countDocuments({
      ...bookingFilter,
      travelDate: { $gte: todayStart, $lte: todayEnd },
      transport: { $exists: true, $not: { $size: 0 } },
    }),
    Cab.aggregate([
      { $match: cabFilter },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$cost', 0] } } } },
    ]),
    Cab.aggregate([
      { $match: cabFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: bookingFilter },
      { $unwind: { path: '$transport', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: { $ifNull: ['$transport.vehicleType', '$transport.vendorName'] },
          trips: { $sum: 1 },
        },
      },
      { $sort: { trips: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const fleetOverview = Object.entries(FLEET_STATUS_META).map(([key, meta]) => {
    const row = fleetRows.find((r) => r._id === key);
    return { key, label: meta.label, color: meta.color, count: row?.count || 0 };
  });

  const mostUsed = mostUsedRows.map((row) => ({
    name: row._id ? String(row._id).charAt(0).toUpperCase() + String(row._id).slice(1) : 'Vehicle',
    trips: row.trips,
    vehicleType: formatCabTypeLabel(row._id),
  }));

  return {
    totalVehicles,
    totalFlights,
    todaysBookings,
    totalCostWeek: weekCostRow[0]?.total || 0,
    fleetOverview,
    mostUsed,
  };
}

async function listCabs(query = {}, { branchId, summary } = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 10, maxLimit: 100 });
  const filter = withBranch({}, branchId);

  if (query.vehicleType?.trim()) {
    filter.vehicleType = { $regex: query.vehicleType.trim(), $options: 'i' };
  }
  if (query.pickup?.trim()) {
    filter.pickupLocation = { $regex: query.pickup.trim(), $options: 'i' };
  }
  if (query.drop?.trim()) {
    filter.dropLocation = { $regex: query.drop.trim(), $options: 'i' };
  }
  if (query.status?.trim()) {
    filter.status = query.status.trim();
  }
  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { vehicleName: { $regex: q, $options: 'i' } },
      { vehicleType: { $regex: q, $options: 'i' } },
      { registrationNumber: { $regex: q, $options: 'i' } },
      { pickupLocation: { $regex: q, $options: 'i' } },
      { dropLocation: { $regex: q, $options: 'i' } },
      { pickupAddress: { $regex: q, $options: 'i' } },
      { dropAddress: { $regex: q, $options: 'i' } },
    ];
  }

  const baseFilter = withBranch({}, branchId);
  const [rows, total, vehicleTypes, pickups, drops, statuses] = await Promise.all([
    Cab.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Cab.countDocuments(filter),
    Cab.distinct('vehicleType', baseFilter),
    Cab.distinct('pickupLocation', baseFilter),
    Cab.distinct('dropLocation', baseFilter),
    Cab.distinct('status', baseFilter),
  ]);

  const transportSummary = summary || await aggregateTransportSummary({ branchId });

  return {
    tab: 'cabs',
    ...paginatedResponse(rows.map(mapCabRow), { page, limit, total }),
    summary: transportSummary,
    fleetOverview: transportSummary.fleetOverview,
    mostUsed: transportSummary.mostUsed,
    filters: {
      vehicleTypes: vehicleTypes.filter(Boolean).sort(),
      pickups: pickups.filter(Boolean).sort(),
      drops: drops.filter(Boolean).sort(),
      statuses: statuses.filter(Boolean).sort(),
    },
  };
}

async function listFlights(query = {}, { branchId, summary } = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 10, maxLimit: 100 });
  const filter = withBranch({}, branchId);

  if (query.status?.trim()) {
    filter.status = query.status.trim();
  }
  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { airline: { $regex: q, $options: 'i' } },
      { flightNumber: { $regex: q, $options: 'i' } },
      { departure: { $regex: q, $options: 'i' } },
      { arrival: { $regex: q, $options: 'i' } },
    ];
  }

  const [rows, total] = await Promise.all([
    Flight.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Flight.countDocuments(filter),
  ]);

  const transportSummary = summary || await aggregateTransportSummary({ branchId });

  return {
    tab: 'flights',
    ...paginatedResponse(rows.map(mapFlightRow), { page, limit, total }),
    summary: transportSummary,
    fleetOverview: transportSummary.fleetOverview,
    mostUsed: transportSummary.mostUsed,
    filters: {
      statuses: ['available', 'booked', 'cancelled'],
    },
  };
}

async function listTransport(query = {}, { branchId } = {}) {
  if (query.catalog === 'true' || query.catalog === true) {
    const [cabs, flights] = await Promise.all([
      Cab.find(withBranch({}, branchId)).sort({ createdAt: -1 }).lean(),
      Flight.find(withBranch({}, branchId)).sort({ createdAt: -1 }).lean(),
    ]);
    return {
      cabs: cabs.map(mapCabRow),
      flights: flights.map(mapFlightRow),
    };
  }

  const summary = await aggregateTransportSummary({ branchId });
  const tab = query.tab === 'flights' ? 'flights' : 'cabs';

  if (tab === 'flights') {
    return listFlights(query, { branchId, summary });
  }
  return listCabs(query, { branchId, summary });
}

async function listBookings(query = {}, { branchId } = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 10, maxLimit: 100 });
  const filter = withBranch(notArchivedFilter(), branchId);

  const statusList = resolveStatusFilter(query.status);
  if (statusList) filter.status = { $in: statusList };

  if (query.bookingStatus) {
    filter.status = query.bookingStatus;
  }

  if (query.destination?.trim()) {
    filter.destination = { $regex: query.destination.trim(), $options: 'i' };
  }

  if (query.package?.trim()) {
    filter.packageName = { $regex: query.package.trim(), $options: 'i' };
  }

  if (query.dateFrom || query.dateTo) {
    filter.travelDate = {};
    if (query.dateFrom) filter.travelDate.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.travelDate.$lte = end;
    }
  }

  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { customerName: { $regex: q, $options: 'i' } },
      { bookingNumber: { $regex: q, $options: 'i' } },
      { destination: { $regex: q, $options: 'i' } },
      { customerPhone: { $regex: q, $options: 'i' } },
      { packageName: { $regex: q, $options: 'i' } },
    ];
  }

  const [rows, total, summary, destinations, packages] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(filter),
    aggregateBookingSummary(filter),
    Booking.distinct('destination', filter),
    Booking.distinct('packageName', { ...filter, packageName: { $nin: [null, ''] } }),
  ]);

  return {
    ...paginatedResponse(rows, { page, limit, total }),
    summary,
    filters: {
      destinations: destinations.filter(Boolean).sort(),
      packages: packages.filter(Boolean).sort(),
    },
  };
}

async function createBooking(payload, actor) {
  const bookingNumber = await nextBookingNumber();
  const pendingAmount = Math.max(0, Number(payload.totalAmount || 0) - Number(payload.advanceReceived || 0));

  const booking = await Booking.create({
    ...payload,
    bookingNumber,
    status: payload.status || 'booking_received',
    pendingAmount,
    assignedTo: payload.assignedTo || actor?._id,
    createdBy: actor?._id,
  });

  if (booking.status === 'confirmed') {
    await createOperationsTasksForBooking(booking, actor);
    notifyBookingConfirmed(booking.toObject()).catch(() => {});
  }

  await cacheService.invalidate('ops:');
  return booking;
}

async function updateBooking(id, payload, actor) {
  const prev = await Booking.findById(id).lean();
  if (!prev) return null;

  const allowed = [
    'status', 'paymentStatus', 'itinerary', 'hotels', 'transport', 'activities',
    'hotelConfirmation', 'cabConfirmation', 'activityConfirmation', 'voucherStatus',
    'totalAmount', 'advanceReceived', 'assignedTo', 'travelDate', 'returnDate',
    'packageName', 'destination',
  ];
  const patch = Object.fromEntries(
    Object.entries(payload || {}).filter(([key]) => allowed.includes(key))
  );

  if (patch.totalAmount != null || patch.advanceReceived != null) {
    const total = Number(patch.totalAmount ?? prev.totalAmount ?? 0);
    const advance = Number(patch.advanceReceived ?? prev.advanceReceived ?? 0);
    patch.pendingAmount = Math.max(0, total - advance);
  }

  const booking = await Booking.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
  if (!booking) return null;

  const wasNotConfirmed = !['confirmed', 'in_progress'].includes(prev.status);
  if (wasNotConfirmed && booking.status === 'confirmed') {
    await createOperationsTasksForBooking(booking, actor);
    notifyBookingConfirmed(booking.toObject()).catch(() => {});
  }

  await cacheService.invalidate('ops:');
  return booking;
}

async function buildBookingPayloadFromPayment(payment) {
  const [quotation, lead] = await Promise.all([
    payment.quotation ? Quotation.findById(payment.quotation).lean() : null,
    payment.lead ? Lead.findById(payment.lead).lean() : null,
  ]);

  let executive = null;
  if (quotation?.createdByExecutive) {
    executive = await User.findById(quotation.createdByExecutive).select('name').lean();
  }

  const snap = quotation?.packageSnapshot || {};
  const totalAmount = payment.amount || quotation?.pricing?.total || quotation?.costing?.grandTotal || 0;
  const travelDate = lead?.travelDate || null;
  let returnDate = lead?.returnDate || null;
  if (travelDate && snap.duration && !returnDate) {
    returnDate = new Date(travelDate);
    returnDate.setDate(returnDate.getDate() + Number(snap.duration));
  }

  return {
    branchId: payment.branchId,
    lead: payment.lead,
    quotation: payment.quotation,
    customerName: payment.customerName || lead?.name || 'Customer',
    customerPhone: lead?.phone || '',
    customerEmail: lead?.email || '',
    destination: lead?.destination || snap.destination || 'TBD',
    packageName: snap.name || snap.title || '',
    travelDate,
    returnDate,
    adults: lead?.adults || lead?.travelers || lead?.pax || 2,
    children: lead?.children || 0,
    status: payment.status === 'paid' ? 'confirmed' : 'booking_received',
    paymentStatus: payment.status === 'paid' ? 'paid' : payment.status === 'partial' ? 'partial' : 'pending',
    totalAmount,
    advanceReceived: payment.paidAmount || 0,
    pendingAmount: Math.max(0, totalAmount - (payment.paidAmount || 0)),
    quotationReference: quotation?.quoteNumber || '',
    executiveName: executive?.name || '',
    hotels: quotation ? mapQuoteHotels(quotation, travelDate) : [],
    transport: quotation ? mapQuoteTransport(quotation) : [],
    activities: quotation ? mapQuoteActivities(quotation) : [],
    itinerary: quotation ? mapQuoteItinerary(quotation, travelDate) : [],
    hotelConfirmation: 'pending',
    cabConfirmation: 'pending',
    voucherStatus: 'pending',
  };
}

async function createBookingFromPayment(paymentId, actor) {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) return null;
  if (!['paid', 'partial'].includes(payment.status)) return null;

  let existing = payment.booking ? await Booking.findById(payment.booking) : null;
  if (!existing) {
    const identities = [
      ...(payment.lead ? [{ lead: payment.lead }] : []),
      ...(payment.quotation ? [{ quotation: payment.quotation }] : []),
    ];
    if (identities.length) existing = await Booking.findOne({ $or: identities });
  }

  if (existing) {
    const total = Number(payment.amount) || Number(existing.totalAmount) || 0;
    const advance = Number(payment.paidAmount) || 0;
    const nextStatus = payment.status === 'paid' ? 'paid' : 'partial';
    const bookingStatus =
      payment.status === 'paid' &&
      ['booking_received', 'pending_verification', 'pending'].includes(existing.status)
        ? 'confirmed'
        : existing.status;
    const updated = await updateBooking(existing._id, {
      totalAmount: total,
      advanceReceived: advance,
      paymentStatus: nextStatus,
      status: bookingStatus,
    }, actor);
    if (String(payment.booking || '') !== String(existing._id)) {
      await Payment.findByIdAndUpdate(paymentId, { booking: existing._id });
    }
    return updated;
  }

  const payload = await buildBookingPayloadFromPayment(payment);
  const booking = await createBooking(payload, actor);

  await Payment.findByIdAndUpdate(paymentId, { booking: booking._id });
  return booking;
}

async function listTasks(query = {}, { branchId } = {}) {
  const filter = withBranch({}, branchId);
  if (query.status) filter.status = query.status;
  if (query.bookingId) filter.booking = query.bookingId;
  return TripTask.find(filter).sort({ dueDate: 1, createdAt: -1 }).limit(100).lean();
}

async function createTask(payload, actor) {
  return TripTask.create({ ...payload, createdBy: actor?._id });
}

async function updateTask(id, payload) {
  const patch = { ...payload };
  if (payload.status === 'completed') patch.completedAt = new Date();
  return TripTask.findByIdAndUpdate(id, patch, { new: true });
}

async function listDocuments(bookingId) {
  return TripDocument.find({ booking: bookingId }).sort({ createdAt: -1 }).lean();
}

async function addDocument(bookingId, payload, actor) {
  const booking = await Booking.findById(bookingId).select('branchId').lean();
  return TripDocument.create({
    ...payload,
    booking: bookingId,
    branchId: booking?.branchId,
    uploadedBy: actor?._id,
  });
}

async function buildReports(branchId) {
  const base = withBranch(notArchivedFilter(), branchId);
  const [byStatus, monthlyTrips, vendorPerformance, payments] = await Promise.all([
    Booking.aggregate([
      { $match: base },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { ...base, travelDate: { $exists: true } } },
      {
        $group: {
          _id: { y: { $year: '$travelDate' }, m: { $month: '$travelDate' } },
          trips: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { '_id.y': -1, '_id.m': -1 } },
      { $limit: 12 },
    ]),
    Vendor.aggregate([
      { $match: withBranch({ status: 'active' }, branchId) },
      { $group: { _id: '$type', count: { $sum: 1 }, outstanding: { $sum: '$outstandingBalance' } } },
    ]),
    Payment.aggregate([
      { $match: withBranch({}, branchId) },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
          paid: { $sum: '$paidAmount' },
        },
      },
    ]),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
  const totalBookings = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const completedTrips = statusMap.completed || 0;
  const revenue = monthlyTrips.reduce((s, r) => s + (r.revenue || 0), 0);

  const summary = {
    totalBookings,
    activeTrips: statusMap.in_progress || 0,
    completedTrips,
    pendingBookings:
      (statusMap.booking_received || 0) +
      (statusMap.pending_verification || 0) +
      (statusMap.pending || 0),
    revenue,
    fulfillmentRate: totalBookings ? Math.round((completedTrips / totalBookings) * 100) : 0,
    avgTripValue: totalBookings ? Math.round(revenue / totalBookings) : 0,
    activeVendors: vendorPerformance.reduce((s, r) => s + r.count, 0),
  };

  return {
    summary,
    bookingsByStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    monthlyTrips: monthlyTrips
      .map((r) => ({
        month: `${String(r._id.m).padStart(2, '0')}/${r._id.y}`,
        trips: r.trips,
        revenue: r.revenue,
      }))
      .reverse(),
    vendorPerformance: vendorPerformance.map((r) => ({
      name: r._id || 'Other',
      bookings: r.count,
      outstanding: r.outstanding || 0,
      rating: '—',
    })),
    payments,
  };
}

function enrichTripRow(booking, category, now = new Date()) {
  const travel = booking.travelDate ? new Date(booking.travelDate) : null;
  const returnDate = booking.returnDate ? new Date(booking.returnDate) : null;
  const startsInDays = travel ? Math.ceil((travel - now) / 86400000) : null;
  const endsInDays = returnDate ? Math.ceil((returnDate - now) / 86400000) : null;

  let durationDays = 0;
  let durationNights = 0;
  if (travel && returnDate) {
    durationDays = Math.max(1, Math.ceil((returnDate - travel) / 86400000));
    durationNights = Math.max(0, durationDays - 1);
  }

  const activities = booking.activities || [];
  const activitiesBooked = activities.filter((a) => ['booked', 'completed'].includes(a.status)).length
    || activities.length;

  const displayStatusMap = {
    confirmed: { label: 'Confirmed', tone: 'green' },
    booking_received: { label: 'Booking Received', tone: 'blue' },
    pending_verification: { label: 'Pending Verification', tone: 'amber' },
    pending: { label: 'Pending', tone: 'amber' },
    in_progress: { label: 'On Trip', tone: 'emerald' },
    completed: { label: 'Completed', tone: 'slate' },
    cancelled: { label: 'Cancelled', tone: 'rose' },
    refund_pending: { label: 'Refund Pending', tone: 'orange' },
    refund_completed: { label: 'Refunded', tone: 'slate' },
  };

  const displayStatus = displayStatusMap[booking.status] || { label: booking.status, tone: 'slate' };

  let footerMessage = '';
  let footerDateLabel = '';
  if (category === 'upcoming' && startsInDays != null) {
    footerMessage = startsInDays === 0 ? 'Trip starts today' : `Trip starts in ${startsInDays} Day${startsInDays === 1 ? '' : 's'}`;
    footerDateLabel = travel
      ? `On ${travel.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '';
  } else if (category === 'ongoing') {
    footerMessage = 'Currently traveling';
    footerDateLabel = travel
      ? `Started ${travel.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '';
  } else if (category === 'completed') {
    footerMessage = 'Trip completed successfully';
    footerDateLabel = returnDate
      ? `Returned ${returnDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '';
  } else if (category === 'cancelled') {
    footerMessage = 'Trip cancelled';
    footerDateLabel = '';
  }

  return {
    ...booking,
    startsInDays,
    endsInDays,
    durationDays,
    durationNights,
    durationLabel: durationDays ? `${durationDays} Days / ${durationNights} Nights` : null,
    activitiesBooked,
    hotelStatus: booking.hotelConfirmation === 'confirmed' ? 'confirmed' : 'pending',
    transportStatus: booking.cabConfirmation === 'confirmed' ? 'confirmed' : 'pending',
    displayStatus,
    footerMessage,
    footerDateLabel,
    footerTone: displayStatus.tone,
  };
}

const TRIP_TRACKER_SELECT = [
  'bookingNumber',
  'customerName',
  'customerPhone',
  'destination',
  'packageName',
  'travelDate',
  'returnDate',
  'adults',
  'children',
  'status',
  'hotelConfirmation',
  'cabConfirmation',
  'activities',
  'hotels',
  'transport',
  'voucherStatus',
  'createdAt',
].join(' ');

async function getTripTracker(branchId) {
  const base = withBranch(notArchivedFilter(), branchId);
  const now = new Date();
  const weekEnd = endOfDay(new Date(Date.now() + 7 * 86400000));

  const [upcoming, ongoing, completed, cancelled, upcomingDepartures] = await Promise.all([
    Booking.find({
      ...base,
      travelDate: { $gt: now },
      status: { $in: ['confirmed', 'booking_received', 'pending_verification', 'pending'] },
    })
      .sort({ travelDate: 1 })
      .limit(50)
      .select(TRIP_TRACKER_SELECT)
      .lean(),
    Booking.find({ ...base, status: 'in_progress' })
      .sort({ travelDate: 1 })
      .limit(50)
      .select(TRIP_TRACKER_SELECT)
      .lean(),
    Booking.find({ ...base, status: 'completed' })
      .sort({ returnDate: -1 })
      .limit(50)
      .select(TRIP_TRACKER_SELECT)
      .lean(),
    Booking.find({ ...base, status: { $in: ['cancelled', 'refund_pending', 'refund_completed'] } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select(TRIP_TRACKER_SELECT)
      .lean(),
    Booking.find({
      ...base,
      travelDate: { $gte: startOfDay(now), $lte: weekEnd },
      status: { $nin: ['cancelled', 'completed', 'refund_completed'] },
    })
      .sort({ travelDate: 1 })
      .limit(8)
      .select(TRIP_TRACKER_SELECT)
      .lean(),
  ]);

  const enrichedUpcoming = upcoming.map((b) => enrichTripRow(b, 'upcoming', now));
  const enrichedOngoing = ongoing.map((b) => enrichTripRow(b, 'ongoing', now));
  const enrichedCompleted = completed.map((b) => enrichTripRow(b, 'completed', now));
  const enrichedCancelled = cancelled.map((b) => enrichTripRow(b, 'cancelled', now));

  const summary = {
    upcoming: enrichedUpcoming.length,
    ongoing: enrichedOngoing.length,
    completed: enrichedCompleted.length,
    cancelled: enrichedCancelled.length,
  };

  const statusOverview = [
    { status: 'upcoming', label: 'Upcoming', count: summary.upcoming, color: '#22C55E' },
    { status: 'ongoing', label: 'Ongoing', count: summary.ongoing, color: '#3B82F6' },
    { status: 'completed', label: 'Completed', count: summary.completed, color: '#8B5CF6' },
    { status: 'cancelled', label: 'Cancelled', count: summary.cancelled, color: '#EF4444' },
  ];

  const departures = upcomingDepartures.map((b) => {
    const startsInDays = b.travelDate
      ? Math.ceil((new Date(b.travelDate) - now) / 86400000)
      : null;
    return {
      _id: b._id,
      bookingNumber: b.bookingNumber,
      customerName: b.customerName,
      destination: b.destination,
      travelDate: b.travelDate,
      daysLeft: startsInDays,
      daysLeftLabel: startsInDays === 0 ? 'Today' : `${startsInDays} Day${startsInDays === 1 ? '' : 's'} Left`,
    };
  });

  return {
    summary,
    upcoming: enrichedUpcoming,
    ongoing: enrichedOngoing,
    completed: enrichedCompleted,
    cancelled: enrichedCancelled,
    statusOverview,
    upcomingDepartures: departures,
  };
}

module.exports = {
  STATUS_ROUTE_MAP,
  getDashboard,
  listBookings,
  createBooking,
  buildBookingPayloadFromPayment,
  updateBooking,
  createBookingFromPayment,
  listTasks,
  createTask,
  updateTask,
  listDocuments,
  addDocument,
  buildReports,
  getTripTracker,
  listHotels,
  listTransport,
  nextBookingNumber,
};
