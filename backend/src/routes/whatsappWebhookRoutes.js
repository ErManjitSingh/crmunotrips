const express = require('express');
const {
  verifyWebhook,
  receiveWebhook,
  webhookStatus,
} = require('../controllers/whatsappWebhookController');

const router = express.Router();

router.get('/status', webhookStatus);
router.get('/', verifyWebhook);
router.post('/', receiveWebhook);

module.exports = router;
