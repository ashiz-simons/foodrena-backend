// src/services/redis.js
const Redis = require('ioredis');
require('dotenv').config();

/**
 * Redis is OPTIONAL but SAFE.
 * This file NEVER exports null.
 * If Redis is down, publish() becomes a no-op.
 */

const REDIS_ENABLED =
  process.env.REDIS_ENABLED === 'true' ||
  process.env.REDIS_ENABLED === '1';

if (!REDIS_ENABLED) {
  console.warn('⚠️ Redis explicitly disabled via REDIS_ENABLED');

  module.exports = {
    publish: async () => {},
    get: async () => null,
    set: async () => null,
    quit: async () => {}
  };

  return;
}

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 2000);
    return delay;
  }
});

// ---- logging ----
redis.on('connect', () => {
  console.log('🔴 Redis connected');
});

redis.on('ready', () => {
  console.log('✅ Redis ready');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('close', () => {
  console.warn('⚠️ Redis connection closed');
});

// ---- safe connect ----
(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error('❌ Redis failed to connect:', err.message);
  }
})();

module.exports = redis;
