// api/src/controllers/paymentWebhookController.js
const Stripe = require('stripe');
const config = require('../config');
const stripe = new Stripe(config.stripe.secret);

exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // TODO: fulfill order, mark payment as complete
      console.log('PaymentIntent was successful!', paymentIntent.id);
      break;
    case 'charge.succeeded':
      // handle charge
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.json({ received: true });
};

exports.paystackWebhook = async (req, res) => {
  // Paystack sends JSON with x-paystack-signature header for webhook verification.
  const signature = req.headers['x-paystack-signature'];
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET;
  const body = JSON.stringify(req.body || {});
  const crypto = require('crypto');
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');

  if (signature !== hash) {
    console.warn('Invalid Paystack webhook signature');
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  // TODO: handle event.event and event.data
  console.log('Paystack webhook event', event.event);
  res.sendStatus(200);
};
