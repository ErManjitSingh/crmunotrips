const mongoose = require('mongoose');
const { mongoUri, nodeEnv } = require('./env');

let eventsRegistered = false;

function logTargetUri(uri) {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname?.replace(/^\//, '') || '(default)';
    console.log(`[MongoDB] Target: ${parsed.hostname}:${parsed.port || '27017'}/${dbName}`);
  } catch {
    console.log('[MongoDB] Connecting…');
  }
}

function registerConnectionEvents() {
  if (eventsRegistered) return;
  eventsRegistered = true;

  mongoose.connection.on('connected', () => {
    console.log(`[MongoDB] Connected — host: ${mongoose.connection.host}, db: ${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected');
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('[MongoDB] Connection closed (SIGINT)');
    process.exit(0);
  });
}

/**
 * Connect to MongoDB. Exits process on failure so the API does not run without a database.
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  registerConnectionEvents();
  logTargetUri(mongoUri);

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      socketTimeoutMS: 45000,
    });

    if (nodeEnv === 'development') {
      mongoose.set('debug', false);
    }

    return conn;
  } catch (err) {
    console.error('[MongoDB] Failed to connect:', err.message);
    console.error('[MongoDB] Check that MongoDB is running and MONGO_URI in backend/.env is correct.');
    process.exit(1);
  }
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

function getDbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const readyState = mongoose.connection.readyState;
  return {
    connected: readyState === 1,
    state: states[readyState] || 'unknown',
    name: mongoose.connection.name || null,
  };
}

module.exports = { connectDB, isDbConnected, getDbStatus };
