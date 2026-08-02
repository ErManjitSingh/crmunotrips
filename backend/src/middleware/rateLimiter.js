const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

function isAuthOrHealth(req) {
  const path = req.originalUrl || req.url || '';
  return (
    path.startsWith('/api/health') ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/register') ||
    path.startsWith('/api/webhooks/facebook') ||
    path.startsWith('/api/facebook/webhook') ||
    path.startsWith('/api/webhooks/whatsapp')
  );
}

/** Prefer per-user bucket (shared office NAT) over shared public IP. */
function clientKey(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ') && auth.length > 20) {
    const hash = crypto.createHash('sha256').update(auth).digest('hex').slice(0, 32);
    return `u:${hash}`;
  }
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  validate: { keyGeneratorIpFallback: false },
  message: { message: 'Too many requests, please try again later.' },
  skip: isAuthOrHealth,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
});

module.exports = { apiLimiter, authLimiter };
