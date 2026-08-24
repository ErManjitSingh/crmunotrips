const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getPublicConfig,
  getAdminConfig,
  putConfig,
  resetConfig,
} = require('../controllers/leadStatusConfigController');

router.use(protect);

router.get('/', getPublicConfig);
router.get('/admin', authorize('admin'), getAdminConfig);
router.put('/', authorize('admin'), putConfig);
router.post('/reset', authorize('admin'), resetConfig);

// Warm cache so first request / cold detection uses DB options
require('../services/leadStatusConfigService')
  .getConfig({ includeDisabled: false })
  .catch(() => {});

module.exports = router;
