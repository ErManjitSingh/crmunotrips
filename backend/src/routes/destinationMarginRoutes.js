const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  listMargins,
  upsertMargin,
  bulkUpsertMargins,
  lookupMargin,
} = require('../controllers/destinationMarginController');

const router = express.Router();

router.use(protect);

router.get('/lookup', lookupMargin);
router.get('/', authorize('admin', 'sales_manager'), listMargins);
router.put('/bulk', authorize('admin', 'sales_manager'), bulkUpsertMargins);
router.put('/:destinationId', authorize('admin', 'sales_manager'), upsertMargin);

module.exports = router;
