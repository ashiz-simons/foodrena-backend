const Redis = require('ioredis');
require('dotenv').config();

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

const REDIS_TLS = process.env.REDIS_TLS === 'true';

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  // ✅ Upstash requires TLS
  tls: REDIS_TLS ? {} : undefined,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 5) return null; // stop retrying after 5 attempts
    return Math.min(times * 100, 2000);
  }
});

redis.on('connect', () => console.log('🔴 Redis connected'));
redis.on('ready', () => console.log('✅ Redis ready'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));
redis.on('close', () => console.warn('⚠️ Redis connection closed'));

(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error('❌ Redis failed to connect:', err.message);
  }
})();

module.exports = redis;