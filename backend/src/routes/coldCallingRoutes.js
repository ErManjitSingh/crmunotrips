const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getMyLeadsHandler,
  requireAssignedLead,
  requireCallableLead,
  callAccessHandler,
  addCallHandler,
  callHistoryHandler,
} = require('../controllers/coldCallingController');

const router = express.Router();

// Cold Calling users only. (Admin manages assignments through the Executive Lead Status routes.)
router.use(protect, authorize('cold_calling'));

router.get('/my-leads', getMyLeadsHandler);

// Per-lead calling: every route first proves an active assignment for the signed-in agent.
router.post('/leads/:id/call-access', requireAssignedLead, requireCallableLead, callAccessHandler);
router.post('/leads/:id/call-notes', requireAssignedLead, requireCallableLead, addCallHandler);
router.get('/leads/:id/call-history', requireAssignedLead, callHistoryHandler);

module.exports = router;
