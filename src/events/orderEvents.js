const redis = require('../services/redis');

async function emit(event, payload) {
  try {
    await redis.publish(event, JSON.stringify(payload));
  } catch (err) {
    // Redis is optional — never crash
  }
}

module.exports = {
  orderCreated: (data) => emit('order.created', data),
  orderUpdated: (data) => emit('order.updated', data),
  orderCancelled: (data) => emit('order.cancelled', data),
  paymentConfirmed: (data) => emit('payment.confirmed', data)
};
