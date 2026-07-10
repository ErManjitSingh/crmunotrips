const { getRedisClient } = require('../config/redis');

const memory = new Map();
const DEFAULT_TTL_MS = 60_000;
const MEMORY_MAX_KEYS = 5000;

function trimMemory() {
  if (memory.size <= MEMORY_MAX_KEYS) return;
  const overflow = memory.size - MEMORY_MAX_KEYS;
  const keys = [...memory.keys()].slice(0, overflow);
  keys.forEach((key) => memory.delete(key));
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
  const value = await factory();
  await set(key, value, ttlMs);
  return value;
}

async function invalidate(prefix) {
  if (!prefix) {
    memory.clear();
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
