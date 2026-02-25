const RiderWallet = require("../models/RiderWallet");
const RiderWithdrawal = require("../models/RiderWithdrawal");

/**
 * Rider requests withdrawal
 */
exports.requestWithdrawal = async (req, res) => {
  const { amount } = req.body;

  const wallet = await RiderWallet.findOne({ rider: req.user.id });

  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  if (wallet.balance < amount) {
    return res.status(400).json({ message: "Insufficient balance" });
  }

  // deduct immediately
  wallet.balance -= amount;
  await wallet.save();

  const withdrawal = await RiderWithdrawal.create({
    rider: req.user.id,
    wallet: wallet._id,
    amount,
    status: "completed",
  });

  res.json({
    message: "Withdrawal successful",
    balance: wallet.balance,
    withdrawal,
  });
};

/**
 * Rider views withdrawals
 */
exports.getMyWithdrawals = async (req, res) => {
  try {
    const riderId = req.rider._id;

    const withdrawals = await RiderWithdrawal.find({ rider: riderId })
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch withdrawals",
      error: err.message
    });
  }
};
