const { getRedisClient } = require('../config/redis');

const memory = new Map();
const inFlight = new Map();
const cancelledInFlight = new WeakSet();
const DEFAULT_TTL_MS = 60_000;
const MEMORY_MAX_KEYS = 2000;

function trimMemory() {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
  if (memory.size <= MEMORY_MAX_KEYS) return;
  let overflow = memory.size - MEMORY_MAX_KEYS;
  for (const key of memory.keys()) {
    memory.delete(key);
    overflow -= 1;
    if (overflow <= 0) break;
  }
}

async function scanAndDelete(redis, pattern) {
  let cursor = '0';
  const batch = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length) batch.push(...keys);
    if (batch.length >= 200) {
      await redis.del(...batch.splice(0, batch.length));
    }
  } while (cursor !== '0');
  if (batch.length) await redis.del(...batch);
}

async function get(key) {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.expiresAt > Date.now()) return parsed.value;
      await redis.del(key);
      return null;
    } catch {
      /* fall through */
    }
  }

  const hit = memory.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (hit) memory.delete(key);
  return null;
}

async function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  const payload = { value, expiresAt: Date.now() + ttlMs };
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(payload), 'PX', ttlMs);
      return;
    } catch {
      /* fall through */
    }
  }
  memory.set(key, payload);
  trimMemory();
}

async function getOrSet(key, factory, ttlMs = DEFAULT_TTL_MS) {
  const cached = await get(key);
  if (cached !== null) return cached;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const value = await factory();
    if (!cancelledInFlight.has(promise)) await set(key, value, ttlMs);
    return value;
  })();
  inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }
}

async function invalidate(prefix) {
  if (!prefix) {
    memory.clear();
    for (const promise of inFlight.values()) cancelledInFlight.add(promise);
    inFlight.clear();
    const redis = getRedisClient();
    if (redis) {
      try {
        await scanAndDelete(redis, '*');
      } catch {
        /* ignore */
      }
    }
    return;
  }

  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) {
      cancelledInFlight.add(inFlight.get(key));
      inFlight.delete(key);
    }
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      await scanAndDelete(redis, `${prefix}*`);
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  get,
  set,
  getOrSet,
  invalidate,
  DEFAULT_TTL_MS,
};
