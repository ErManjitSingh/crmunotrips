const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { port, corsOrigins } = require('./config/env');
const { connectDB, getDbStatus } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { ensureIndexes } = require('./config/ensureIndexes');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { applySecurityMiddleware } = require('./middleware/security');
const { apiLimiter } = require('./middleware/rateLimiter');
const { initializeSocket } = require('./socket');
const { NOTIFICATIONS_ENABLED } = require('./config/notifications');
const { startNotificationScheduler } = require('./services/notificationScheduler');
const { purgeOldActivityLogs } = require('./services/activityService');
const { startEmailInboxPoller } = require('./services/emailInboxService');
const { archiveOldTrips } = require('./services/operationsArchiveService');

const app = express();

// Behind Nginx — trust first proxy hop for correct per-client rate limits
app.set('trust proxy', true);

applySecurityMiddleware(app);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      if (
        req.originalUrl &&
        (req.originalUrl.startsWith('/api/webhooks/facebook') ||
          req.originalUrl.startsWith('/api/webhooks/whatsapp'))
      ) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  immutable: false,
}));

app.get('/api/health', (req, res) => {
  const db = getDbStatus();
  res.status(200).json({
    status: 'ok',
    service: 'unotravel-crm-api',
    database: db,
    time: new Date().toISOString(),
  });
});

app.get('/api', (req, res) => {
  res.json({ message: 'UNO Trips CRM API', version: '1.0.0' });
});

app.use('/api', apiLimiter, apiRoutes);
app.use(errorHandler);

async function start() {
  await connectDB();
  await connectRedis();
  await ensureIndexes();
  await purgeOldActivityLogs();

  const httpServer = http.createServer(app);
  initializeSocket(httpServer);
  if (NOTIFICATIONS_ENABLED) {
    startNotificationScheduler();
  } else {
    console.log('[NotificationScheduler] Disabled (set NOTIFICATIONS_ENABLED=true to enable)');
  }
  startEmailInboxPoller();

  archiveOldTrips().catch(() => {});
  setInterval(() => archiveOldTrips().catch(() => {}), 24 * 60 * 60 * 1000);
  setInterval(() => purgeOldActivityLogs().catch(() => {}), 60 * 60 * 1000);

  httpServer.listen(port, () => {
    console.log(`[API] Running on http://127.0.0.1:${port}`);
    console.log(`[API] Health: http://127.0.0.1:${port}/api/health`);
  });
}

start().catch((err) => {
  console.error('[API] Failed to start:', err.message);
  process.exit(1);
});

module.exports = app;
