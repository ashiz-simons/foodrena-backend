const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

router.post('/initiate', auth, paymentController.initiatePayment);
router.get('/verify/:reference', paymentController.verifyPayment);

// ✅ RAW BODY ONLY HERE
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.paystackWebhook
);

module.exports = router;
