const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { requirePermission } = require('../middleware/requirePermission');
const {
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
} = require('../controllers/operationsController');

router.use(protect, authorize('operations_manager', 'admin'));

router.get('/dashboard', requirePermission('operations', 'view'), getDashboard);
router.get('/trip-tracker', requirePermission('operations', 'view'), getTripTracker);
router.get('/bookings', requirePermission('operations', 'view'), listBookings);
router.post('/bookings', requirePermission('operations', 'create'), createBooking);
router.get('/bookings/:id', requirePermission('operations', 'view'), getBooking);
router.post('/bookings/:id/sync-quotation', requirePermission('operations', 'edit'), syncBookingQuotation);
router.put('/bookings/:id', requirePermission('operations', 'edit'), updateBooking);
router.post('/bookings/:id/itinerary-pdf', requirePermission('operations', 'edit'), generateItineraryPdf);
router.post('/bookings/:id/confirm-hotel', requirePermission('operations', 'edit'), confirmHotel);
router.post('/bookings/:id/confirm-cab', requirePermission('operations', 'edit'), confirmCab);
router.post(
  '/bookings/:id/hotels/:hotelAssignmentId/voucher/send',
  requirePermission('operations', 'edit'),
  sendHotelVoucher
);
router.post(
  '/bookings/:id/transport/:transportAssignmentId/voucher/send',
  requirePermission('operations', 'edit'),
  sendTransportVoucher
);
router.get('/bookings/:id/documents', requirePermission('operations', 'view'), listDocuments);
router.post('/bookings/:id/documents', requirePermission('operations', 'edit'), addDocument);

router.get('/hotels', requirePermission('operations', 'view'), listHotels);
router.post('/hotels', requirePermission('operations', 'create'), createHotel);
router.put('/hotels/:id', requirePermission('operations', 'edit'), updateHotel);
router.delete('/hotels/:id', requirePermission('operations', 'delete'), deleteHotel);

router.get('/transport', requirePermission('operations', 'view'), getTransport);

router.get('/activities', requirePermission('operations', 'view'), listActivities);
router.get('/activities/:id', requirePermission('operations', 'view'), getActivity);
router.post('/activities', requirePermission('operations', 'create'), createActivity);
router.put('/activities/:id', requirePermission('operations', 'edit'), updateActivity);
router.delete('/activities/:id', requirePermission('operations', 'delete'), deleteActivity);

router.get('/vendors', requirePermission('operations', 'view'), listVendors);
router.get('/vendors/:id', requirePermission('operations', 'view'), getVendor);
router.post('/vendors', requirePermission('operations', 'create'), createVendor);
router.put('/vendors/:id', requirePermission('operations', 'edit'), updateVendor);
router.delete('/vendors/:id', requirePermission('operations', 'delete'), deleteVendor);

router.get('/vouchers', requirePermission('operations', 'view'), listVouchers);
router.post('/vouchers', requirePermission('operations', 'create'), createVoucher);
router.put('/vouchers/:id', requirePermission('operations', 'edit'), updateVoucher);

router.get('/tasks', requirePermission('operations', 'view'), listTasks);
router.post('/tasks', requirePermission('operations', 'create'), createTask);
router.patch('/tasks/:id', requirePermission('operations', 'edit'), updateTask);

router.get('/tickets', requirePermission('operations', 'view'), listTickets);
router.post('/tickets', requirePermission('operations', 'create'), createTicket);
router.put('/tickets/:id', requirePermission('operations', 'edit'), updateTicket);

router.get('/reports', requirePermission('operations', 'view'), getReports);
router.get('/profile', getProfile);
router.get('/calendar', requirePermission('operations', 'view'), getCalendar);

module.exports = router;
