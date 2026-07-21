const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');
const Activity = require('../models/Activity');
const Voucher = require('../models/Voucher');
const SupportTicket = require('../models/SupportTicket');
const Hotel = require('../models/Hotel');
const Cab = require('../models/Cab');
const Flight = require('../models/Flight');
const Payment = require('../models/Payment');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const ops = require('../services/operationsService');
const cacheService = require('../services/cacheService');
const { generateVoucherDocument, generateItineraryDocument } = require('../services/operationsVoucherService');
const { sendMailMessage, isEmailConfigured } = require('../services/emailService');
const {
  enrichBookingWithQuotation,
  syncBookingFromQuotation,
} = require('../services/operationsQuotationSyncService');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN');
}

async function enrichHotelContacts(hotels = []) {
  const ids = hotels.map((hotel) => hotel.hotelId).filter(Boolean);
  const names = hotels.map((hotel) => hotel.hotelName).filter(Boolean);
  if (!ids.length && !names.length) return hotels;

  const catalog = await Hotel.find({
    $or: [
      ...(ids.length ? [{ _id: { $in: ids } }] : []),
      ...(names.length ? [{ name: { $in: names } }] : []),
    ],
  }).select('name address location contactPerson phone email').lean();
  const byId = new Map(catalog.map((hotel) => [String(hotel._id), hotel]));
  const byName = new Map(catalog.map((hotel) => [String(hotel.name).toLowerCase(), hotel]));

  return hotels.map((hotel) => {
    const match = byId.get(String(hotel.hotelId)) || byName.get(String(hotel.hotelName || '').toLowerCase());
    if (!match) return hotel;
    return {
      ...hotel,
      hotelId: hotel.hotelId || match._id,
      address: hotel.address || match.address || match.location || '',
      contactPerson: hotel.contactPerson || match.contactPerson || '',
      phone: hotel.phone || match.phone || '',
      email: hotel.email || match.email || '',
    };
  });
}

async function enrichTransportContacts(rows = []) {
  const ids = rows.map((row) => row.vendorId).filter(Boolean);
  const names = rows.map((row) => row.vendorName).filter(Boolean);
  if (!ids.length && !names.length) return rows;
  const vendors = await Vendor.find({
    $or: [
      ...(ids.length ? [{ _id: { $in: ids } }] : []),
      ...(names.length ? [{ name: { $in: names } }] : []),
    ],
  }).select('name contactPerson phone email').lean();
  const byId = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));
  const byName = new Map(vendors.map((vendor) => [serviceKey(vendor.name), vendor]));
  return rows.map((row) => {
    const vendor = byId.get(String(row.vendorId)) || byName.get(serviceKey(row.vendorName));
    if (!vendor) return row;
    return {
      ...row,
      vendorId: row.vendorId || vendor._id,
      vendorName: row.vendorName || vendor.name,
      contactPerson: row.contactPerson || vendor.contactPerson || '',
      phone: row.phone || vendor.phone || '',
      email: row.email || vendor.email || '',
    };
  });
}

function paymentLedger(payments = []) {
  return payments.flatMap((payment) => {
    if (payment.installments?.length) {
      return payment.installments.map((item, index) => ({
        _id: item._id,
        paymentId: payment._id,
        invoiceNumber: payment.invoiceNumber,
        receiptNumber: payment.receiptNumber,
        installment: index + 1,
        amount: item.amount,
        receivedAt: item.receivedAt,
        method: item.method,
        reference: item.reference,
        note: item.note,
        receiptHtml: payment.receiptHtml,
      }));
    }
    if (Number(payment.paidAmount) > 0) {
      return [{
        _id: payment._id,
        paymentId: payment._id,
        invoiceNumber: payment.invoiceNumber,
        receiptNumber: payment.receiptNumber,
        installment: 1,
        amount: payment.paidAmount,
        receivedAt: payment.paidAt || payment.updatedAt || payment.createdAt,
        method: payment.method,
        note: payment.notes,
        receiptHtml: payment.receiptHtml,
      }];
    }
    return [];
  }).sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
}

function serviceKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function uniqueDays(values = []) {
  return [...new Set(values.map(Number).filter((day) => Number.isInteger(day) && day > 0))].sort((a, b) => a - b);
}

function hotelServiceDays(booking, hotels) {
  const names = new Set(hotels.map((hotel) => serviceKey(hotel.hotelName)));
  const itineraryDays = (booking.itinerary || [])
    .filter((day) => names.has(serviceKey(day.dayHotel?.hotelName || day.accommodation)))
    .map((day) => day.day);
  const assignmentDays = hotels.flatMap((hotel) => {
    const start = Number(hotel.day);
    const nights = Math.max(1, Number(hotel.nights) || 1);
    return start ? Array.from({ length: nights }, (_, index) => start + index) : [];
  });
  return uniqueDays([...itineraryDays, ...assignmentDays]);
}

function transportServiceDays(booking, transportRows) {
  const vehicleNumbers = new Set(transportRows.map((row) => serviceKey(row.vehicleNumber)).filter(Boolean));
  const vehicleTypes = new Set(transportRows.map((row) => serviceKey(row.vehicleType)).filter(Boolean));
  const itineraryDays = (booking.itinerary || [])
    .filter((day) => {
      const cab = day.dayCab || {};
      return (
        (cab.vehicleNumber && vehicleNumbers.has(serviceKey(cab.vehicleNumber))) ||
        (cab.vehicleType && vehicleTypes.has(serviceKey(cab.vehicleType)))
      );
    })
    .map((day) => day.day);
  const assignmentDays = transportRows.flatMap((row) => [
    ...(row.days || []),
    ...(row.day ? [row.day] : []),
  ]);
  return uniqueDays([...itineraryDays, ...assignmentDays]);
}

function dayLabel(days = []) {
  if (!days.length) return 'As per itinerary';
  return days.map((day) => `Day ${day}`).join(', ');
}

const getDashboard = asyncHandler(async (req, res) => {
  // Command center shows org-wide metrics across all branches.
  const data = await ops.getDashboard(null);
  res.json(data);
});

const listBookings = asyncHandler(async (req, res) => {
  const result = await ops.listBookings(req.query, { branchId: req.branchId });
  res.json(result);
});

const createBooking = asyncHandler(async (req, res) => {
  const booking = await ops.createBooking({ ...req.body, branchId: req.branchId || req.body.branchId }, req.user);
  res.status(201).json(booking);
});

const getBooking = asyncHandler(async (req, res) => {
  let booking = await Booking.findById(req.params.id).lean();
  if (!booking) throw new ApiError(404, 'Booking not found');
  booking = await enrichBookingWithQuotation(booking);
  const [tasks, documents, payments, vouchers, hotels, transport] = await Promise.all([
    ops.listTasks({ bookingId: req.params.id }),
    ops.listDocuments(req.params.id),
    Payment.find({
      $or: [
        { booking: booking._id },
        ...(booking.lead ? [{ lead: booking.lead }] : []),
      ],
    }).sort({ createdAt: 1 }).lean(),
    Voucher.find({ booking: booking._id }).sort({ createdAt: -1 }).lean(),
    enrichHotelContacts(booking.hotels || []),
    enrichTransportContacts(booking.transport || []),
  ]);
  res.json({
    ...booking,
    hotels,
    transport,
    tasks,
    documents,
    payments,
    paymentLedger: paymentLedger(payments),
    vouchers,
  });
});

const syncBookingQuotation = asyncHandler(async (req, res) => {
  const result = await syncBookingFromQuotation(req.params.id, { force: req.body?.force === true });
  if (!result?.booking) throw new ApiError(404, 'Booking not found');
  if (!result.quotation) throw new ApiError(404, 'No quotation linked to this booking');
  await cacheService.invalidate('ops:');
  const [tasks, documents] = await Promise.all([
    ops.listTasks({ bookingId: req.params.id }),
    ops.listDocuments(req.params.id),
  ]);
  res.json({
    ...result.booking,
    tasks,
    documents,
    quotationPreview: result.quotationPreview,
    quotationMeta: result.quotationPreview?.meta,
    syncedFromQuotation: result.synced,
  });
});

const updateBooking = asyncHandler(async (req, res) => {
  const booking = await ops.updateBooking(req.params.id, req.body, req.user);
  if (!booking) throw new ApiError(404, 'Booking not found');
  res.json(booking);
});

const confirmHotel = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  booking.hotelConfirmation = 'confirmed';
  booking.hotels = (booking.hotels || []).map((h) => ({ ...h.toObject?.() || h, status: 'confirmed' }));
  if (['booking_received', 'pending_verification', 'pending'].includes(booking.status)) {
    booking.status = 'confirmed';
  }
  await booking.save();
  await cacheService.invalidate('ops:');
  res.json(booking);
});

const confirmCab = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  booking.cabConfirmation = 'confirmed';
  booking.transport = (booking.transport || []).map((t) => ({ ...t.toObject?.() || t, status: 'confirmed' }));
  await booking.save();
  await cacheService.invalidate('ops:');
  res.json(booking);
});

const listHotels = asyncHandler(async (req, res) => {
  const result = await ops.listHotels(req.query, { branchId: null });
  res.json(result);
});

const createHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.create({ ...req.body, branchId: req.branchId });
  res.status(201).json(hotel);
});

const updateHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  res.json(hotel);
});

const deleteHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findByIdAndDelete(req.params.id);
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  res.json({ message: 'Hotel deleted' });
});

const getTransport = asyncHandler(async (req, res) => {
  const result = await ops.listTransport(req.query, { branchId: null });
  res.json(result);
});

const listActivities = asyncHandler(async (req, res) => {
  const activities = await Activity.find().populate('vendor', 'name').sort({ createdAt: -1 }).lean();
  res.json(activities);
});

const getActivity = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id).populate('vendor', 'name').lean();
  if (!activity) throw new ApiError(404, 'Activity not found');
  res.json(activity);
});

const createActivity = asyncHandler(async (req, res) => {
  let vendorName = '';
  if (req.body.vendorId) {
    const vendor = await Vendor.findById(req.body.vendorId);
    vendorName = vendor?.name || '';
  }
  const activity = await Activity.create({
    ...req.body,
    vendor: req.body.vendorId,
    vendorName,
    status: 'active',
  });
  res.status(201).json(activity);
});

const updateActivity = asyncHandler(async (req, res) => {
  const activity = await Activity.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!activity) throw new ApiError(404, 'Activity not found');
  res.json(activity);
});

const deleteActivity = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw new ApiError(404, 'Activity not found');
  await activity.deleteOne();
  res.json({ message: 'Activity deleted' });
});

const listVendors = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type === 'cab' ? 'transport' : req.query.type;
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { destination: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  const vendors = await Vendor.find(filter).sort({ name: 1 }).lean();
  res.json(vendors);
});

const getVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id).lean();
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  res.json(vendor);
});

const createVendor = asyncHandler(async (req, res) => {
  const body = { ...req.body, branchId: req.branchId };
  if (body.type === 'cab') body.type = 'transport';
  const vendor = await Vendor.create({ status: 'active', rating: 4.0, ...body });
  res.status(201).json(vendor);
});

const updateVendor = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.type === 'cab') body.type = 'transport';
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  res.json(vendor);
});

const deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  await vendor.deleteOne();
  res.json({ message: 'Vendor deleted' });
});

const listVouchers = asyncHandler(async (req, res) => {
  const vouchers = await Voucher.find()
    .populate('booking', 'bookingNumber customerName destination')
    .sort({ createdAt: -1 })
    .lean();
  res.json(vouchers);
});

const createVoucher = asyncHandler(async (req, res) => {
  const booking = req.body.bookingId ? await Booking.findById(req.body.bookingId).lean() : null;
  if (!booking) throw new ApiError(400, 'Valid booking is required');

  const type = req.body.type === 'cab' ? 'transport' : req.body.type;
  const count = await Voucher.countDocuments();
  const voucherNumber = `VCH-${(type?.[0] || 'M').toUpperCase()}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const details = {
    title: req.body.title || `${booking.destination} ${type} voucher`,
    validFrom: req.body.validFrom || booking.travelDate,
    validUntil: req.body.validUntil || booking.returnDate,
  };

  const voucherDoc = {
    type,
    booking: booking._id,
    voucherNumber,
    bookingNumber: booking.bookingNumber,
    customerName: booking.customerName,
    branchId: booking.branchId || req.branchId,
    status: 'issued',
    issuedAt: new Date(),
    issuedBy: req.user._id,
    details,
  };

  const pdfUrl = generateVoucherDocument(voucherDoc, booking);
  voucherDoc.pdfUrl = pdfUrl;

  const voucher = await Voucher.create(voucherDoc);

  if (type === 'master' || req.body.type === 'master') {
    await Booking.findByIdAndUpdate(booking._id, { voucherStatus: 'issued' });
  }

  await cacheService.invalidate('ops:');
  res.status(201).json(voucher);
});

const sendHotelVoucher = asyncHandler(async (req, res) => {
  if (!isEmailConfigured()) throw new ApiError(503, 'Email service is not configured');

  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const hotel = booking.hotels.id(req.params.hotelAssignmentId);
  if (!hotel) throw new ApiError(404, 'Hotel assignment not found');
  const groupedHotels = booking.hotels.filter(
    (row) => serviceKey(row.hotelName) === serviceKey(hotel.hotelName)
  );
  const serviceDays = hotelServiceDays(booking, groupedHotels);

  const recipientEmail = String(req.body.email || hotel.email || '').trim().toLowerCase();
  if (!recipientEmail) throw new ApiError(400, 'Hotel email is required');

  groupedHotels.forEach((row) => {
    row.email = recipientEmail;
    if (req.body.phone != null) row.phone = String(req.body.phone).trim();
    if (req.body.contactPerson != null) row.contactPerson = String(req.body.contactPerson).trim();
    if (req.body.confirmationNumber != null) {
      row.confirmationNumber = String(req.body.confirmationNumber).trim();
    }
  });

  const existingVoucherId = groupedHotels.find((row) => row.voucherId)?.voucherId;
  let voucher = existingVoucherId ? await Voucher.findById(existingVoucherId) : null;
  if (!voucher) {
    const count = await Voucher.countDocuments();
    const voucherNumber = `VCH-H-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const details = {
      title: `${hotel.hotelName || booking.destination} hotel voucher`,
      validFrom: hotel.checkIn || booking.travelDate,
      validUntil: hotel.checkOut || booking.returnDate,
      hotelAssignmentId: hotel._id,
      hotelAssignmentIds: groupedHotels.map((row) => row._id),
      hotel: hotel.toObject(),
      serviceDays,
      paidAmount: booking.advanceReceived || 0,
      pendingAmount: booking.pendingAmount || 0,
    };
    const voucherDoc = {
      type: 'hotel',
      booking: booking._id,
      voucherNumber,
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerName,
      branchId: booking.branchId || req.branchId,
      status: 'issued',
      issuedAt: new Date(),
      issuedBy: req.user._id,
      recipientName: hotel.contactPerson || hotel.hotelName,
      recipientEmail,
      recipientPhone: hotel.phone || '',
      details,
    };
    voucherDoc.pdfUrl = generateVoucherDocument(voucherDoc, {
      ...booking.toObject(),
      hotels: groupedHotels.map((row) => row.toObject()),
    });
    voucher = await Voucher.create(voucherDoc);
  }
  voucher.details = {
    ...(voucher.details || {}),
    serviceDays,
    hotelAssignmentIds: groupedHotels.map((row) => row._id),
  };
  voucher.pdfUrl = generateVoucherDocument(voucher.toObject(), {
    ...booking.toObject(),
    hotels: groupedHotels.map((row) => row.toObject()),
  });
  groupedHotels.forEach((row) => { row.voucherId = voucher._id; });

  const subject = String(
    req.body.subject || `Hotel booking voucher ${voucher.voucherNumber} — ${booking.customerName}`
  ).trim();
  const customMessage = String(req.body.message || '').trim();
  const attachmentHtml = require('fs').readFileSync(
    require('path').join(__dirname, '../..', voucher.pdfUrl.replace(/^\/uploads\//, 'uploads/')),
    'utf8'
  );
  let mailResult;
  try {
    mailResult = await sendMailMessage({
      to: recipientEmail,
      subject,
      text: customMessage || `Please find the hotel voucher for ${booking.customerName}, booking ${booking.bookingNumber}.`,
      html: `<p>${escapeHtml(customMessage || 'Please find the attached hotel booking voucher.')}</p>
        <p><strong>Guest:</strong> ${escapeHtml(booking.customerName)}<br/>
        <strong>Hotel:</strong> ${escapeHtml(hotel.hotelName)}<br/>
        <strong>Service Days:</strong> ${escapeHtml(dayLabel(serviceDays))}<br/>
        <strong>Stay:</strong> ${emailDate(hotel.checkIn || booking.travelDate)} to ${emailDate(hotel.checkOut || booking.returnDate)}</p>`,
      attachments: [{
        filename: `${voucher.voucherNumber}.html`,
        content: Buffer.from(attachmentHtml, 'utf8').toString('base64'),
        contentType: 'text/html',
      }],
    });
  } catch (error) {
    voucher.deliveryStatus = 'failed';
    voucher.deliveryError = error.message;
    await Promise.all([voucher.save(), booking.save()]);
    throw new ApiError(502, `Voucher email failed: ${error.message}`);
  }

  const sentAt = new Date();
  voucher.status = 'sent';
  voucher.deliveryStatus = 'sent';
  voucher.sentAt = sentAt;
  voucher.sentBy = req.user._id;
  voucher.recipientEmail = recipientEmail;
  voucher.recipientName = hotel.contactPerson || hotel.hotelName;
  voucher.recipientPhone = hotel.phone || '';
  voucher.emailMessageId = mailResult.messageId || '';
  voucher.deliveryError = '';
  groupedHotels.forEach((row) => { row.voucherSentAt = sentAt; });
  await Promise.all([voucher.save(), booking.save(), cacheService.invalidate('ops:')]);

  res.json({
    voucher,
    hotel: hotel.toObject(),
    groupedHotelIds: groupedHotels.map((row) => row._id),
    serviceDays,
  });
});

const sendTransportVoucher = asyncHandler(async (req, res) => {
  if (!isEmailConfigured()) throw new ApiError(503, 'Email service is not configured');

  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const transport = booking.transport.id(req.params.transportAssignmentId);
  if (!transport) throw new ApiError(404, 'Transport assignment not found');

  const targetKey = serviceKey(
    transport.vendorName || transport.vehicleNumber || `${transport.vehicleType}-${transport.driverPhone}`
  );
  const groupedTransport = booking.transport.filter((row) => serviceKey(
    row.vendorName || row.vehicleNumber || `${row.vehicleType}-${row.driverPhone}`
  ) === targetKey);
  const serviceDays = transportServiceDays(booking, groupedTransport);
  const recipientEmail = String(req.body.email || transport.email || '').trim().toLowerCase();
  if (!recipientEmail) throw new ApiError(400, 'Transport vendor email is required');

  groupedTransport.forEach((row) => {
    row.email = recipientEmail;
    if (req.body.phone != null) row.phone = String(req.body.phone).trim();
    if (req.body.contactPerson != null) row.contactPerson = String(req.body.contactPerson).trim();
  });

  const existingVoucherId = groupedTransport.find((row) => row.voucherId)?.voucherId;
  let voucher = existingVoucherId ? await Voucher.findById(existingVoucherId) : null;
  if (!voucher) {
    const count = await Voucher.countDocuments();
    const voucherNumber = `VCH-T-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    voucher = await Voucher.create({
      type: 'transport',
      booking: booking._id,
      voucherNumber,
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerName,
      branchId: booking.branchId || req.branchId,
      status: 'issued',
      issuedAt: new Date(),
      issuedBy: req.user._id,
      recipientName: transport.contactPerson || transport.vendorName || 'Transport Vendor',
      recipientEmail,
      recipientPhone: transport.phone || transport.driverPhone || '',
      details: {
        title: `${transport.vendorName || transport.vehicleType} transport voucher`,
        validFrom: transport.pickupDate || booking.travelDate,
        validUntil: booking.returnDate,
        transportAssignmentId: transport._id,
        transportAssignmentIds: groupedTransport.map((row) => row._id),
        serviceDays,
        paidAmount: booking.advanceReceived || 0,
        pendingAmount: booking.pendingAmount || 0,
      },
    });
  }

  voucher.details = {
    ...(voucher.details || {}),
    serviceDays,
    transportAssignmentIds: groupedTransport.map((row) => row._id),
  };
  voucher.pdfUrl = generateVoucherDocument(voucher.toObject(), {
    ...booking.toObject(),
    transport: groupedTransport.map((row) => row.toObject()),
  });
  groupedTransport.forEach((row) => { row.voucherId = voucher._id; });

  const subject = String(
    req.body.subject || `Transport voucher ${voucher.voucherNumber} — ${booking.customerName}`
  ).trim();
  const customMessage = String(req.body.message || '').trim();
  const attachmentHtml = require('fs').readFileSync(
    require('path').join(__dirname, '../..', voucher.pdfUrl.replace(/^\/uploads\//, 'uploads/')),
    'utf8'
  );

  let mailResult;
  try {
    mailResult = await sendMailMessage({
      to: recipientEmail,
      subject,
      text: customMessage || `Please find the transport voucher for ${booking.customerName}, booking ${booking.bookingNumber}.`,
      html: `<p>${escapeHtml(customMessage || 'Please find the attached transport voucher.')}</p>
        <p><strong>Guest:</strong> ${escapeHtml(booking.customerName)}<br/>
        <strong>Vehicle:</strong> ${escapeHtml(transport.vehicleType?.replace(/_/g, ' '))}<br/>
        <strong>Service Days:</strong> ${escapeHtml(dayLabel(serviceDays))}<br/>
        <strong>Route:</strong> ${escapeHtml(transport.pickupLocation)} to ${escapeHtml(transport.dropLocation)}</p>`,
      attachments: [{
        filename: `${voucher.voucherNumber}.html`,
        content: Buffer.from(attachmentHtml, 'utf8').toString('base64'),
        contentType: 'text/html',
      }],
    });
  } catch (error) {
    voucher.deliveryStatus = 'failed';
    voucher.deliveryError = error.message;
    await Promise.all([voucher.save(), booking.save()]);
    throw new ApiError(502, `Voucher email failed: ${error.message}`);
  }

  const sentAt = new Date();
  voucher.status = 'sent';
  voucher.deliveryStatus = 'sent';
  voucher.sentAt = sentAt;
  voucher.sentBy = req.user._id;
  voucher.recipientEmail = recipientEmail;
  voucher.recipientName = transport.contactPerson || transport.vendorName || 'Transport Vendor';
  voucher.recipientPhone = transport.phone || transport.driverPhone || '';
  voucher.emailMessageId = mailResult.messageId || '';
  voucher.deliveryError = '';
  groupedTransport.forEach((row) => { row.voucherSentAt = sentAt; });
  await Promise.all([voucher.save(), booking.save(), cacheService.invalidate('ops:')]);

  res.json({
    voucher,
    transport: transport.toObject(),
    groupedTransportIds: groupedTransport.map((row) => row._id),
    serviceDays,
  });
});

const generateItineraryPdf = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).lean();
  if (!booking) throw new ApiError(404, 'Booking not found');
  const pdfUrl = generateItineraryDocument(booking);
  res.json({ pdfUrl });
});

const updateVoucher = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.type === 'cab') body.type = 'transport';
  const voucher = await Voucher.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!voucher) throw new ApiError(404, 'Voucher not found');
  res.json(voucher);
});

const listTickets = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const tickets = await SupportTicket.find(filter).sort({ updatedAt: -1 }).lean();
  res.json(tickets);
});

const createTicket = asyncHandler(async (req, res) => {
  const count = await SupportTicket.countDocuments();
  const ticket = await SupportTicket.create({
    ...req.body,
    branchId: req.branchId,
    ticketNumber: `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
    lastUpdate: new Date(),
  });
  res.status(201).json(ticket);
});

const updateTicket = asyncHandler(async (req, res) => {
  const patch = { ...req.body, lastUpdate: new Date() };
  if (req.body.status === 'resolved' || req.body.status === 'closed') {
    patch.resolvedAt = new Date();
  }
  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  res.json(ticket);
});

const listTasks = asyncHandler(async (req, res) => {
  const tasks = await ops.listTasks(req.query, { branchId: req.branchId });
  res.json(tasks);
});

const createTask = asyncHandler(async (req, res) => {
  const task = await ops.createTask({ ...req.body, branchId: req.branchId }, req.user);
  res.status(201).json(task);
});

const updateTask = asyncHandler(async (req, res) => {
  const task = await ops.updateTask(req.params.id, req.body);
  if (!task) throw new ApiError(404, 'Task not found');
  res.json(task);
});

const listDocuments = asyncHandler(async (req, res) => {
  const docs = await ops.listDocuments(req.params.id);
  res.json(docs);
});

const addDocument = asyncHandler(async (req, res) => {
  const doc = await ops.addDocument(req.params.id, req.body, req.user);
  res.status(201).json(doc);
});

const getTripTracker = asyncHandler(async (req, res) => {
  const data = await ops.getTripTracker(null);
  res.json(data);
});

const getReports = asyncHandler(async (req, res) => {
  const data = await ops.buildReports(req.branchId);
  res.json(data);
});

const getProfile = asyncHandler(async (req, res) => {
  res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      roleName: 'Operations Manager',
      department: req.user.department || 'Operations',
    },
    stats: { bookingsManaged: await Booking.countDocuments() },
  });
});

const getCalendar = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ travelDate: { $exists: true }, archivedAt: { $exists: false } }).lean();
  const events = bookings.map((b) => ({
    _id: b._id,
    title: `${b.customerName} — ${b.destination}`,
    start: b.travelDate,
    end: b.returnDate || b.travelDate,
    type: 'travel',
    status: b.status,
  }));
  res.json(events);
});

module.exports = {
  getDashboard,
  listBookings,
  createBooking,
  generateItineraryPdf,
  getBooking,
  syncBookingQuotation,
  updateBooking,
  confirmHotel,
  confirmCab,
  listHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  getTransport,
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
  listVouchers,
  createVoucher,
  updateVoucher,
  sendHotelVoucher,
  sendTransportVoucher,
  listTickets,
  createTicket,
  updateTicket,
  listTasks,
  createTask,
  updateTask,
  listDocuments,
  addDocument,
  getTripTracker,
  getReports,
  getProfile,
  getCalendar,
};
