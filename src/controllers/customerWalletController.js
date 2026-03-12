const CustomerWallet = require("../models/CustomerWallet");

// ── GET /api/customer-wallet ─────────────────────────────────────────────
exports.getWallet = async (req, res) => {
  try {
    let wallet = await CustomerWallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await CustomerWallet.create({ user: req.user._id, balance: 0 });
    }
    res.json({ balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/customer-wallet/transactions ────────────────────────────────
exports.getTransactions = async (req, res) => {
  try {
    let wallet = await CustomerWallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await CustomerWallet.create({ user: req.user._id, balance: 0 });
    }
    // Most recent first
    const txns = [...wallet.transactions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json(txns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Internal helper — called by cancel order ─────────────────────────────
exports.creditWallet = async (userId, amount, description, orderId = null) => {
  let wallet = await CustomerWallet.findOne({ user: userId });
  if (!wallet) wallet = new CustomerWallet({ user: userId, balance: 0 });
  wallet.balance += amount;
  wallet.transactions.push({ type: "credit", amount, description, orderId });
  await wallet.save();
  return wallet;
};

// ── Internal helper — called by checkout ─────────────────────────────────
// Returns { charged, remaining } — charged = amount actually deducted from wallet
exports.debitWallet = async (userId, amount) => {
  let wallet = await CustomerWallet.findOne({ user: userId });
  if (!wallet || wallet.balance <= 0) return { charged: 0, remaining: amount };
  const charged = Math.min(wallet.balance, amount);
  wallet.balance -= charged;
  wallet.transactions.push({
    type: "debit",
    amount: charged,
    description: "Used for order payment",
  });
  await wallet.save();
  return { charged, remaining: amount - charged };
};