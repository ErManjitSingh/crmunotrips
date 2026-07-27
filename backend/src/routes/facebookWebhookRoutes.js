const express = require('express');
const {
  verifyWebhook,
  receiveWebhook,
  webhookStatus,
  webhookDebug,
} = require('../controllers/facebookWebhookController');

const router = express.Router();

router.get('/status', webhookStatus);
router.get('/debug', webhookDebug);
router.get('/', verifyWebhook);
router.post('/', receiveWebhook);

module.exports = router;
