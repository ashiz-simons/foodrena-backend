const axios = require("axios");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const paystack = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

/**
 * ============================
 * INIT TRANSACTION
 * ============================
 */
exports.initializeTransaction = async ({
  email,
  amount,
  reference,
  callback_url,
}) => {
  try {
    const response = await paystack.post("/transaction/initialize", {
      email,
      amount,
      reference,
      callback_url,
    });

    return response.data;
  } catch (err) {
    console.error("❌ PAYSTACK INIT ERROR:", err.response?.data || err.message);
    throw err;
  }
};

/**
 * ============================
 * VERIFY TRANSACTION
 * ============================
 */
exports.verifyTransaction = async (reference) => {
  try {
    const response = await paystack.get(
      `/transaction/verify/${reference}`
    );

    return response.data;
  } catch (err) {
    console.error("❌ PAYSTACK VERIFY ERROR:", err.response?.data || err.message);
    throw err;
  }
};