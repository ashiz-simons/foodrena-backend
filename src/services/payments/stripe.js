const Stripe = require('stripe');
const config = require('../../config');
const client = new Stripe(config.stripe.secret);

async function createPaymentIntent(amount, currency='ngn') {
  return client.paymentIntents.create({ amount, currency, automatic_payment_methods: { enabled: true } });
}

module.exports = { createPaymentIntent };
