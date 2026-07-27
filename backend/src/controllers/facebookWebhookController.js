const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const {
  isConfigured,
  verifyWebhookChallenge,
  verifyRequestSignature,
  processFacebookWebhookAsync,
  getDiagnostics,
  probePageTokenHealth,
  recordIncomingWebhook,
  getConfig,
} = require('../services/facebookLeadWebhookService');

/** Meta webhook verification (hub.challenge) — must return plain-text challenge */
const verifyWebhook = asyncHandler(async (req, res) => {
  recordIncomingWebhook({
    method: 'GET',
    path: req.originalUrl,
    query: req.query || {},
    headers: req.headers || {},
    body: null,
    rawBodyLength: 0,
  });

  const challenge = verifyWebhookChallenge(req.query || {});
  res.status(200).type('text/plain').send(challenge);
});

/**
 * Meta leadgen notifications.
 * Always ACK with HTTP 200 quickly, then process Graph + Mongo asynchronously.
 * Returning non-200 causes Meta "Pending" / retries / delivery failures.
 */
const receiveWebhook = asyncHandler(async (req, res) => {
  recordIncomingWebhook({
    method: 'POST',
    path: req.originalUrl,
    query: req.query || {},
    headers: req.headers || {},
    body: req.body || {},
    rawBodyLength: req.rawBody ? Buffer.byteLength(req.rawBody) : 0,
  });

  if (!isConfigured()) {
    console.error('[facebookWebhook] POST received but FACEBOOK_* env incomplete');
    // Still ACK so Meta does not mark delivery as failed while we fix env.
    return res.status(200).json({
      success: true,
      accepted: false,
      message: 'Webhook endpoint alive but Facebook lead webhook is not fully configured',
    });
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!verifyRequestSignature(req.rawBody, signature)) {
    console.error('[facebookWebhook] invalid signature — rejecting');
    throw new ApiError(401, 'Invalid Facebook webhook signature');
  }

  // ACK first (Meta requires ~20s; Graph+Mongo can exceed that under load)
  res.status(200).json({ success: true, accepted: true });

  processFacebookWebhookAsync(req.body || {});
});

/** Status for ops (no secrets) */
const webhookStatus = asyncHandler(async (_req, res) => {
  res.json(getDiagnostics());
});

/**
 * Debug dump — recent inbound verify/POST events + env/db checks.
 * Protect with ?token=FACEBOOK_VERIFY_TOKEN (or header x-fb-debug-token).
 */
const webhookDebug = asyncHandler(async (req, res) => {
  const cfg = getConfig();
  const provided =
    String(req.query.token || req.headers['x-fb-debug-token'] || '').trim();
  if (!cfg.verifyToken || provided !== cfg.verifyToken) {
    throw new ApiError(401, 'Invalid debug token');
  }
  const pageToken = await probePageTokenHealth();
  res.json({
    ...getDiagnostics(),
    pageToken,
    note: 'If recentEvents has no Meta POSTs, the Callback URL is not subscribed/verified in Meta App → Webhooks (subscribed_apps alone does not deliver).',
  });
});

module.exports = {
  verifyWebhook,
  receiveWebhook,
  webhookStatus,
  webhookDebug,
};
