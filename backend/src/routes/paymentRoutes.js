const express = require('express');
const router = express.Router();
const {
  listPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  addRefund,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/requirePermission');

router.use(protect);

router.route('/')
  .get(requirePermission('payments', 'view'), listPayments)
  .post(requirePermission('payments', 'create'), createPayment);
router.post('/:id/refunds', requirePermission('payments', 'edit'), addRefund);
router.route('/:id')
  .get(requirePermission('payments', 'view'), getPayment)
  .put(requirePermission('payments', 'edit'), updatePayment)
  .delete(requirePermission('payments', 'delete'), deletePayment);

module.exports = router;
