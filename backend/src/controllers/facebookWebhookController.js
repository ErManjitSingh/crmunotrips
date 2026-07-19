const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const {
  isConfigured,
  verifyWebhookChallenge,
  verifyRequestSignature,
  processFacebookWebhook,
  getConfig,
} = require('../services/facebookLeadWebhookService');

/** Meta webhook verification (hub.challenge) */
const verifyWebhook = asyncHandler(async (req, res) => {
  const challenge = verifyWebhookChallenge(req.query || {});
  res.status(200).send(challenge);
});

/** Meta leadgen notifications */
const receiveWebhook = asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    throw new ApiError(503, 'Facebook lead webhook is not configured');
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!verifyRequestSignature(req.rawBody, signature)) {
    throw new ApiError(401, 'Invalid Facebook webhook signature');
  }

  // Acknowledge immediately-friendly: still process synchronously but keep work light.
  const summary = await processFacebookWebhook(req.body || {});
  res.status(200).json({ success: true, ...summary });
});

/** Status for ops (no secrets) */
const webhookStatus = asyncHandler(async (_req, res) => {
  const cfg = getConfig();
  res.json({
    ok: true,
    configured: isConfigured(),
    hasVerifyToken: Boolean(cfg.verifyToken),
    hasPageAccessToken: Boolean(cfg.pageAccessToken),
    hasAppSecret: Boolean(cfg.appSecret),
    callbackUrl: 'https://testing.unotrips.com/api/webhooks/facebook',
    defaultDestination: cfg.defaultDestination,
    instructions: [
      '1. Create Meta App → add Webhooks product → Page → subscribe leadgen',
      '2. Callback URL: https://testing.unotrips.com/api/webhooks/facebook',
      '3. Verify token must match FACEBOOK_VERIFY_TOKEN in backend .env',
      '4. Set FACEBOOK_PAGE_ACCESS_TOKEN (long-lived Page token with leads_retrieval)',
      '5. POST /{page-id}/subscribed_apps?subscribed_fields=leadgen',
    ],
  });
});

module.exports = {
  verifyWebhook,
  receiveWebhook,
  webhookStatus,
};
