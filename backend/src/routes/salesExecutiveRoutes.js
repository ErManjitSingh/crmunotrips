const express = require('express');
const { rejectReassignedAwayLead } = require('../middleware/reassignedLeadGuard');
const router = express.Router();
const {
  LEAD_FILTER_KEYS,
  getDashboard,
  listLeads,
  getLeadDetail,
  authorizeLeadCallAccess,
  getLeadQuotationsList,
  getLeadNotesList,
  getLeadPaymentReceiptDoc,
  sendLeadPaymentReceipt,
  updateLead,
  acceptLead,
  getCommercialForm,
  saveCommercialForm,
  addLeadNote,
  listFollowUps,
  getFollowUpSummary,
  createFollowUp,
  updateFollowUp,
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  listCustomers,
  listNotifications,
  getProfile,
  getCalendar,
  listReassignedLeads,
  getReassignedLead,
} = require('../controllers/salesExecutiveController');
const {
  initiateWhatsAppContact,
  sendQuotationWhatsApp,
} = require('../controllers/whatsappContactController');
const { sendLeadEmail, listLeadEmailHistory } = require('../controllers/emailController');
const { logModuleOpened } = require('../controllers/executiveActivityController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { requirePermission } = require('../middleware/requirePermission');

router.use(protect, authorize('sales_executive'));

// A previous owner of a lead reassigned away through Cold Calling gets the reason ("reassigned to X"),
// not a generic 404, on every lead-id route. Authorization itself is unchanged (see reassignedLeadGuard).
router.param('id', rejectReassignedAwayLead);
router.param('idOrFilter', rejectReassignedAwayLead);

// Read-only history of leads reassigned away from me (they are no longer part of my active leads).
router.get('/reassigned-leads', listReassignedLeads);
router.get('/reassigned-leads/:leadId', getReassignedLead);

router.get('/dashboard', getDashboard);
router.get('/customers', listCustomers);
router.get('/notifications', listNotifications);
router.get('/profile', getProfile);
router.get('/calendar', getCalendar);
router.post('/activity/module-opened', logModuleOpened);

router.get('/followups/summary', getFollowUpSummary);
router.get('/followups', listFollowUps);
router.post('/followups', createFollowUp);
router.put('/followups/:id', updateFollowUp);

router.get('/quotations', listQuotations);
router.post('/quotations', createQuotation);
router.get('/quotations/:id', getQuotation);
router.put('/quotations/:id', updateQuotation);

router.get('/leads', listLeads);
router.post('/leads/:id/call-access', authorizeLeadCallAccess);
router.get('/leads/:id/quotations', getLeadQuotationsList);
router.get('/leads/:id/notes-list', getLeadNotesList);
router.get('/leads/:id/payment-receipt', getLeadPaymentReceiptDoc);
router.post('/leads/:id/payment-receipt/send', sendLeadPaymentReceipt);
router.post('/leads/:id/accept', acceptLead);
router.get('/leads/:id/commercial-form', getCommercialForm);
router.post('/leads/:id/commercial-form', saveCommercialForm);
router.get('/leads/:idOrFilter', (req, res, next) => {
  const seg = req.params.idOrFilter;
  if (LEAD_FILTER_KEYS.includes(seg)) {
    req.query.filter = seg;
    return listLeads(req, res, next);
  }
  req.params.id = seg;
  return getLeadDetail(req, res, next);
});
router.put('/leads/:id', updateLead);
router.post('/leads/:id/notes', addLeadNote);
router.post('/leads/:id/whatsapp-contact', requirePermission('whatsapp', 'use'), initiateWhatsAppContact);
router.post('/leads/:id/send-quotation-whatsapp', requirePermission('whatsapp', 'use'), sendQuotationWhatsApp);
router.post('/leads/:id/send-email', requirePermission('email', 'send'), sendLeadEmail);
router.get('/leads/:id/email-history', requirePermission('email', 'send'), listLeadEmailHistory);

module.exports = router;
