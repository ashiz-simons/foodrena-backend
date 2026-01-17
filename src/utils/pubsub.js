const Redis = require('ioredis');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6379 });

async function publish(channel, message) {
  await redis.publish(channel, JSON.stringify(message));
}

module.exports = { publish };
