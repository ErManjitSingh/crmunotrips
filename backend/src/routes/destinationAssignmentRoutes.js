const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  listDestinations,
  createDestination,
  updateDestination,
  deleteDestination,
  listUserMappings,
  updateUserMappings,
  getBranchAssignmentSettings,
  updateBranchAssignmentSettings,
  listAssignmentLogs,
  getReports,
  triggerAutoAssign,
} = require('../controllers/destinationAssignmentController');

router.use(protect);

router.get('/destinations', authorize('admin', 'sales_manager', 'lead_provider'), listDestinations);
router.post('/destinations', authorize('admin'), createDestination);
router.put('/destinations/:id', authorize('admin'), updateDestination);
router.delete('/destinations/:id', authorize('admin'), deleteDestination);

router.get('/user-mappings', authorize('admin', 'sales_manager', 'lead_provider'), listUserMappings);
router.put('/user-mappings', authorize('admin', 'sales_manager', 'lead_provider'), updateUserMappings);

router.get('/branch-settings', authorize('admin', 'sales_manager', 'lead_provider'), getBranchAssignmentSettings);
router.put('/branch-settings', authorize('admin', 'sales_manager', 'lead_provider'), updateBranchAssignmentSettings);

router.get('/logs', authorize('admin', 'sales_manager', 'lead_provider'), listAssignmentLogs);
router.get('/reports', authorize('admin', 'sales_manager', 'lead_provider'), getReports);

router.post('/auto-assign/:leadId', authorize('admin', 'sales_manager', 'lead_provider'), triggerAutoAssign);

module.exports = router;
