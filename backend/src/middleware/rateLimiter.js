const rateLimit = require('express-rate-limit');

function isAuthOrHealth(req) {
  const path = req.originalUrl || req.url || '';
  return (
    path.startsWith('/api/health') ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/register') ||
    path.startsWith('/api/webhooks/facebook')
  );
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
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
