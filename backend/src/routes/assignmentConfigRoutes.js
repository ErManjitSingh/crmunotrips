const express = require('express');
const router = express.Router();
const { getAssignmentStatus, updateAssignmentStatus } = require('../controllers/assignmentConfigController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);
router.get('/status', getAssignmentStatus);
router.put('/status', authorize('admin', 'sales_manager'), updateAssignmentStatus);

module.exports = router;
