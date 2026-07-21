const mongoose = require('mongoose');

const BOOKING_STATUSES = [
  'booking_received',
  'pending_verification',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'refund_pending',
  'refund_completed',
  // legacy
  'pending',
];

const PAYMENT_STATUSES = ['pending', 'partial', 'paid', 'refund_pending', 'refund_completed'];

const hotelAssignmentSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
    externalHotelId: { type: String, trim: true, default: '' },
    hotelName: String,
    destination: String,
    category: String,
    roomType: String,
    mealPlan: { type: String, trim: true, default: '' },
    day: { type: Number, min: 1 },
    nights: { type: Number, min: 1, default: 1 },
    rooms: { type: Number, min: 1, default: 1 },
    checkIn: Date,
    checkOut: Date,
    address: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    confirmationNumber: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'requested', 'confirmed', 'rejected', 'cancelled'],
      default: 'pending',
    },
    confirmationUrl: String,
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    voucherSentAt: Date,
    notes: String,
  },
  { _id: true }
);

const transportAssignmentSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String,
    vehicleType: {
      type: String,
      enum: ['sedan', 'suv', 'innova', 'tempo_traveller', 'bus', 'other'],
      default: 'suv',
    },
    driverName: String,
    driverPhone: String,
    vehicleNumber: String,
    pickupLocation: String,
    dropLocation: String,
    pickupDate: Date,
    status: {
      type: String,
      enum: ['pending', 'requested', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    notes: String,
  },
  { _id: true }
);

const activityAssignmentSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
    name: String,
    vendorName: String,
    scheduledAt: Date,
    status: {
      type: String,
      enum: ['pending', 'booked', 'completed', 'cancelled'],
      default: 'pending',
    },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    notes: String,
  },
  { _id: true }
);

const itineraryDayHotelSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
    hotelName: { type: String, trim: true, default: '' },
    destination: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    roomType: { type: String, trim: true, default: '' },
    mealPlan: { type: String, trim: true, default: '' },
    source: { type: String, enum: ['catalog', 'manual'], default: 'manual' },
  },
  { _id: false }
);

const itineraryDayCabSchema = new mongoose.Schema(
  {
    cabId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cab' },
    vehicleType: { type: String, trim: true, default: '' },
    pickupLocation: { type: String, trim: true, default: '' },
    dropLocation: { type: String, trim: true, default: '' },
    driverName: { type: String, trim: true, default: '' },
    driverPhone: { type: String, trim: true, default: '' },
    vehicleNumber: { type: String, trim: true, default: '' },
    source: { type: String, enum: ['catalog', 'manual'], default: 'manual' },
  },
  { _id: false }
);

const itineraryDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    meals: { type: String, trim: true, default: '' },
    accommodation: { type: String, trim: true, default: '' },
    transport: { type: String, trim: true, default: '' },
    activities: { type: String, trim: true, default: '' },
    date: Date,
    dayHotel: itineraryDayHotelSchema,
    dayCab: itineraryDayCabSchema,
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: { type: String, required: true, unique: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    customerName: { type: String, required: true },
    customerPhone: { type: String, trim: true, default: '' },
    customerEmail: { type: String, trim: true, default: '' },
    destination: { type: String, required: true },
    packageName: { type: String, trim: true, default: '' },
    travelDate: { type: Date, index: true },
    returnDate: { type: Date, index: true },
    adults: { type: Number, default: 1, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'booking_received',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    executiveName: { type: String, trim: true, default: '' },
    salesManagerName: { type: String, trim: true, default: '' },
    quotationReference: { type: String, trim: true, default: '' },
    hotels: [hotelAssignmentSchema],
    transport: [transportAssignmentSchema],
    activities: [activityAssignmentSchema],
    itinerary: [itineraryDaySchema],
    hotelConfirmation: { type: String, default: 'pending' },
    cabConfirmation: { type: String, default: 'pending' },
    activityConfirmation: { type: String, default: 'pending' },
    voucherStatus: { type: String, default: 'pending' },
    totalAmount: { type: Number, default: 0 },
    advanceReceived: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

bookingSchema.index({ travelDate: 1, status: 1 });
bookingSchema.index({ returnDate: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ branchId: 1, status: 1, travelDate: 1 });
bookingSchema.index({ branchId: 1, archivedAt: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
