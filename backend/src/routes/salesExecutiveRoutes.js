const express = require('express');
const router = express.Router();
const {
  LEAD_FILTER_KEYS,
  getDashboard,
  listLeads,
  getLeadDetail,
  getLeadQuotationsList,
  getLeadNotesList,
  getLeadPaymentReceiptDoc,
  sendLeadPaymentReceipt,
  updateLead,
  addLeadNote,
  listFollowUps,
  getFollowUpSummary,
  createFollowUp,
  updateFollowUp,
  listQuotations,
  createQuotation,
  updateQuotation,
  listCustomers,
  listNotifications,
  getProfile,
  getCalendar,
} = require('../controllers/salesExecutiveController');
const { initiateWhatsAppContact } = require('../controllers/whatsappContactController');
const { sendLeadEmail, listLeadEmailHistory } = require('../controllers/emailController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { requirePermission } = require('../middleware/requirePermission');

router.use(protect, authorize('sales_executive'));

router.get('/dashboard', getDashboard);
router.get('/customers', listCustomers);
router.get('/notifications', listNotifications);
router.get('/profile', getProfile);
router.get('/calendar', getCalendar);

router.get('/followups/summary', getFollowUpSummary);
router.get('/followups', listFollowUps);
router.post('/followups', createFollowUp);
router.put('/followups/:id', updateFollowUp);

router.get('/quotations', listQuotations);
router.post('/quotations', createQuotation);
router.put('/quotations/:id', updateQuotation);

router.get('/leads', listLeads);
router.get('/leads/:id/quotations', getLeadQuotationsList);
router.get('/leads/:id/notes-list', getLeadNotesList);
router.get('/leads/:id/payment-receipt', getLeadPaymentReceiptDoc);
router.post('/leads/:id/payment-receipt/send', sendLeadPaymentReceipt);
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
router.post('/leads/:id/send-email', requirePermission('email', 'send'), sendLeadEmail);
router.get('/leads/:id/email-history', requirePermission('email', 'send'), listLeadEmailHistory);

module.exports = router;
