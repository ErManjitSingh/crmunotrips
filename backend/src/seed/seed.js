/**
 * Production seed — run: npm run seed
 * Uses MONGO_URI from backend/.env (default: mongodb://127.0.0.1:27017/testing_unotrips_crm)
 *
 * Sales Manager & Sales Executive demo users are NOT seeded — add them via Admin → Team.
 */
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { jwtSecret } = require('../config/env');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Role = require('../models/Role');
const Team = require('../models/Team');
const Lead = require('../models/Lead');
const LeadNote = require('../models/LeadNote');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const Package = require('../models/Package');
const Hotel = require('../models/Hotel');
const Cab = require('../models/Cab');
const Flight = require('../models/Flight');
const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { ROLE_PERMISSIONS, PERMISSION_MODULES } = require('../config/permissions');
const { ROLES, ROLE_LABELS } = require('../config/roles');

const PASSWORD = process.env.SEED_PASSWORD || '123456';

async function seed() {
  if (!jwtSecret) {
    console.error('JWT_SECRET is not set in backend/.env');
    process.exit(1);
  }

  await connectDB();
  console.log('Connected. Clearing collections…');

  await Promise.all([
    ActivityLog.deleteMany({}),
    Notification.deleteMany({}),
    Payment.deleteMany({}),
    Quotation.deleteMany({}),
    FollowUp.deleteMany({}),
    LeadNote.deleteMany({}),
    Lead.deleteMany({}),
    Booking.deleteMany({}),
    Vendor.deleteMany({}),
    Flight.deleteMany({}),
    Cab.deleteMany({}),
    Hotel.deleteMany({}),
    Package.deleteMany({}),
    Team.deleteMany({}),
    Branch.deleteMany({}),
    User.deleteMany({}),
    Role.deleteMany({}),
  ]);

  const roles = await Role.insertMany(
    ROLES.map((slug) => ({
      name: ROLE_LABELS[slug],
      slug,
      description: `${ROLE_LABELS[slug]} system role`,
      isSystem: true,
      permissions: ROLE_PERMISSIONS[slug],
    }))
  );

  const roleMap = Object.fromEntries(roles.map((r) => [r.slug, r._id]));

  const [shimlaBranch, ptwBranch] = await Branch.insertMany([
    { name: 'Shimla', code: 'SHIMLA', status: 'active' },
    { name: 'PTW', code: 'PTW', status: 'active' },
  ]);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@crm.com',
    password: PASSWORD,
    role: 'admin',
    roleId: roleMap.admin,
    department: 'Management',
    branchId: shimlaBranch._id,
  });

  const operationsManager = await User.create({
    name: 'Operations Manager',
    email: 'ops@crm.com',
    password: PASSWORD,
    role: 'operations_manager',
    roleId: roleMap.operations_manager,
    department: 'Operations',
    branchId: shimlaBranch._id,
  });

  const hrAdmin = await User.create({
    name: 'HR Admin',
    email: 'hr@unotrips.com',
    password: PASSWORD,
    role: 'hr_admin',
    roleId: roleMap.hr_admin,
    department: 'Human Resources',
    branchId: shimlaBranch._id,
  });

  // Sales roles — add via Team Management

  const pkg = await Package.create({
    name: 'Goa Beach Bliss 5D/4N',
    destination: 'Goa',
    duration: 5,
    startingPrice: 28500,
    packageType: 'family',
    itinerary: [
      { day: 1, title: 'Arrival', description: 'Check-in and beach walk', meals: 'Dinner', accommodation: '4 Star Resort' },
      { day: 2, title: 'North Goa', description: 'Sightseeing tour', meals: 'Breakfast', accommodation: '4 Star Resort' },
    ],
    createdBy: admin._id,
    branchId: shimlaBranch._id,
  });

  const [hotel, cab, flight] = await Promise.all([
    Hotel.create({ name: 'Taj Resort Goa', category: '5 Star', location: 'Calangute', roomType: 'Deluxe', mealPlan: 'MAP', price: 8500 }),
    Cab.create({
      vehicleName: 'Innova',
      vehicleType: 'suv',
      registrationNumber: 'KA 01 AB 1234',
      color: 'White',
      fuelType: 'Diesel',
      capacity: 6,
      pickupLocation: 'Airport',
      dropLocation: 'Hotel',
      pickupAddress: 'Dabolim International Airport',
      dropAddress: 'Taj Resort Calangute',
      pickupDate: new Date('2026-06-16T10:30:00'),
      dropDate: new Date('2026-06-16T11:30:00'),
      tripType: 'One Way',
      cost: 3500,
      status: 'available',
    }),
    Flight.create({ airline: 'IndiGo', flightNumber: '6E-204', departure: 'DEL', arrival: 'GOI', cost: 6200 }),
  ]);

  const leads = await Lead.insertMany([
    {
      name: 'Rahul Sharma',
      email: 'rahul@email.com',
      phone: '+91 98765 43210',
      destination: 'Goa',
      travelDate: new Date('2026-06-15'),
      budget: 75000,
      travelers: 4,
      status: 'new',
      source: 'website',
      sourceLabel: 'Website',
      priority: 'high',
      isHot: true,
      createdBy: admin._id,
      branchId: shimlaBranch._id,
    },
    {
      name: 'Priya Mehta',
      email: 'priya.m@email.com',
      phone: '+91 87654 32109',
      destination: 'Kerala',
      travelDate: new Date('2026-07-01'),
      budget: 120000,
      travelers: 2,
      status: 'contacted',
      source: 'referral',
      sourceLabel: 'Referral',
      createdBy: admin._id,
      branchId: shimlaBranch._id,
    },
    {
      name: 'Sample Lead',
      email: 'sample@email.com',
      phone: '+91 76543 21098',
      destination: 'Dubai',
      travelDate: new Date('2026-08-20'),
      budget: 250000,
      travelers: 3,
      status: 'follow_up',
      source: 'social',
      sourceLabel: 'Facebook Ads',
      createdBy: admin._id,
      branchId: shimlaBranch._id,
    },
  ]);

  await FollowUp.create({
    lead: leads[0]._id,
    type: 'call',
    category: 'warm',
    scheduledAt: new Date(Date.now() + 86400000),
    status: 'pending',
    notes: 'Sample follow-up — assign executive after you add users',
    assignedTo: admin._id,
    createdBy: admin._id,
    branchId: shimlaBranch._id,
  });

  await Quotation.create({
    quoteNumber: 'Q-2026-1001',
    lead: leads[0]._id,
    package: pkg._id,
    packageSnapshot: pkg.toObject(),
    status: 'pending_approval',
    pricing: { baseCost: 28500, hotelCost: 17000, cabCost: 3500, flightCost: 12400, taxes: 4200, markup: 8500, discount: 0, total: 74100, profitMargin: 12.8 },
    selectedHotels: [hotel.toObject()],
    selectedCabs: [cab.toObject()],
    selectedFlights: [flight.toObject()],
    createdByExecutive: admin._id,
    createdBy: admin._id,
    branchId: shimlaBranch._id,
    timeline: [
      { type: 'created', date: new Date(), user: 'Admin', notes: 'Initial quote' },
    ],
  });

  await Booking.create({
    bookingNumber: 'BK-2026-001',
    lead: leads[2]._id,
    customerName: 'Sample Lead',
    customerPhone: '+91 76543 21098',
    customerEmail: 'sample@email.com',
    destination: 'Dubai',
    packageName: 'Dubai Explorer 6D/5N',
    travelDate: new Date('2026-08-20'),
    returnDate: new Date('2026-08-25'),
    adults: 3,
    children: 0,
    status: 'booking_received',
    paymentStatus: 'partial',
    totalAmount: 250000,
    advanceReceived: 50000,
    pendingAmount: 200000,
    executiveName: 'Admin User',
    quotationReference: 'Q-2026-1001',
    hotelConfirmation: 'pending',
    cabConfirmation: 'pending',
    voucherStatus: 'pending',
    itinerary: [
      { day: 1, title: 'Arrival Dubai', description: 'Airport pickup & hotel check-in', meals: 'Dinner' },
      { day: 2, title: 'City Tour', description: 'Burj Khalifa & Dubai Mall', meals: 'Breakfast' },
    ],
    assignedTo: operationsManager._id,
    branchId: shimlaBranch._id,
  });

  await Vendor.create({
    name: 'Goa Heritage Hotels',
    type: 'hotel',
    contactPerson: 'Rajesh',
    phone: '+91 98765 00001',
    email: 'sales@goaheritage.com',
    location: 'Goa',
    rating: 4.5,
  });

  await Payment.create({
    invoiceNumber: 'INV-2026-001',
    lead: leads[0]._id,
    customerName: 'Rahul Sharma',
    amount: 74100,
    paidAmount: 20000,
    status: 'partial',
    method: 'bank_transfer',
    dueDate: new Date('2026-06-01'),
    createdBy: admin._id,
    branchId: shimlaBranch._id,
  });

  await Notification.create({
    user: admin._id,
    type: 'quote_approval',
    title: 'Quotation pending approval',
    message: 'Q-2026-1001 — Rahul Sharma — Goa',
    read: false,
    branchId: shimlaBranch._id,
    meta: { quoteNumber: 'Q-2026-1001' },
  });

  console.log('\n✅ Seed complete.\n');
  console.log('Login credentials (password for all):', PASSWORD);
  console.log('  admin@crm.com          — Admin');
  console.log('  ops@crm.com            — Operations Manager');
  console.log('  hr@unotrips.com        — HR Admin (portal: /hr/login)');
  console.log('\n  Add sales roles via Team Management → Add User.\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
