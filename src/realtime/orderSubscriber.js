const Redis = require('ioredis');
const config = require('../config');

const subscriber = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined
});

subscriber.subscribe('order.created', 'order.status.updated');

subscriber.on('message', (channel, message) => {
  const data = JSON.parse(message);

  switch (channel) {
    case 'order.created':
      console.log('🛒 New order:', data);
      break;

    case 'order.status.updated':
      console.log('📦 Order updated:', data);
      break;
  }
});
