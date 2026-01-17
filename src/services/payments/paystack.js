const axios = require('axios');

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
    'Content-Type': 'application/json'
  }
});

exports.initializeTransaction = async ({ email, amount, reference, callback_url }) => {
  const res = await paystack.post('/transaction/initialize', {
    email,
    amount,
    reference,
    callback_url
  });
  return res.data;
};

exports.verifyTransaction = async (reference) => {
  const res = await paystack.get(`/transaction/verify/${reference}`);
  return res.data;
};

exports.refundTransaction = async (reference) => {
  const res = await paystack.post('/refund', { reference });
  return res.data;
};

exports.initiateTransfer = async ({ amount, recipient, reference }) => {
  const res = await paystack.post('/transfer', {
    source: 'balance',
    amount: Math.round(amount * 100),
    recipient,
    reference
  });
  return res.data;
};
