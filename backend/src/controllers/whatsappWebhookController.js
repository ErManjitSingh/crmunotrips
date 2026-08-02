const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const {
  isConfigured,
  verifyWebhookChallenge,
  verifyRequestSignature,
  processWhatsAppWebhook,
  getConfig,
} = require('../services/whatsappCloudService');

const verifyWebhook = asyncHandler(async (req, res) => {
  const challenge = verifyWebhookChallenge(req.query || {});
  res.status(200).send(challenge);
});

const receiveWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyRequestSignature(req.rawBody, signature)) {
    throw new ApiError(401, 'Invalid WhatsApp webhook signature');
  }

  // Always 200 quickly for Meta; process body even if Cloud API not fully configured
  // so verification/setup still works once tokens exist.
  if (!isConfigured()) {
    console.warn('[whatsappWebhook] received event but Cloud API env is incomplete');
  }

  // ACK first (like Facebook webhook) so Meta does not retry under load
  res.status(200).json({ success: true, accepted: true });
  const body = req.body || {};
  setImmediate(() => {
    processWhatsAppWebhook(body).catch((err) => {
      console.error('[whatsappWebhook] async process failed:', err?.message || err);
    });
  });
});

const webhookStatus = asyncHandler(async (_req, res) => {
  const cfg = getConfig();
  res.json({
    ok: true,
    configured: isConfigured(),
    hasVerifyToken: Boolean(cfg.verifyToken),
    hasAccessToken: Boolean(cfg.accessToken),
    hasPhoneNumberId: Boolean(cfg.phoneNumberId),
    hasAppSecret: Boolean(cfg.appSecret),
    callbackUrl: 'https://app.unotrips.com/api/webhooks/whatsapp',
    defaultDestination: cfg.defaultDestination,
    instructions: [
      '1. Meta App → WhatsApp → Configuration → Webhook',
      '2. Callback URL: https://app.unotrips.com/api/webhooks/whatsapp',
      '3. Verify token = WHATSAPP_VERIFY_TOKEN',
      '4. Subscribe: messages',
      '5. Set WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID in backend .env',
    ],
  });
});

module.exports = { verifyWebhook, receiveWebhook, webhookStatus };
