const RiderWithdrawal = require("../models/RiderWithdrawal");
const RiderWallet = require("../models/RiderWallet");

/**
 * Admin gets all rider withdrawals
 */
exports.getWithdrawals = async (req, res) => {
  const withdrawals = await RiderWithdrawal.find()
    .populate("rider", "name email")
    .sort({ createdAt: -1 });

  res.json(withdrawals);
};

/**
 * Admin marks withdrawal paid
 */
exports.markPaid = async (req, res) => {
  const withdrawal = await RiderWithdrawal.findById(req.params.id);

  if (!withdrawal) {
    return res.status(404).json({ message: "Not found" });
  }

  if (withdrawal.status === "paid") {
    return res.status(400).json({ message: "Already paid" });
  }

  withdrawal.status = "paid";
  withdrawal.paidAt = new Date();
  withdrawal.reference = `RIDER_PAYOUT_${Date.now()}`;

  await withdrawal.save();

  res.json({ message: "Withdrawal paid", withdrawal });
};

/**
 * Admin marks failed → refund wallet
 */
exports.markFailed = async (req, res) => {
  const withdrawal = await RiderWithdrawal.findById(req.params.id);

  if (!withdrawal) {
    return res.status(404).json({ message: "Not found" });
  }

  if (withdrawal.status === "paid") {
    return res.status(400).json({ message: "Already paid" });
  }

  withdrawal.status = "failed";
  withdrawal.failureReason = req.body.reason || "Failed";

  await withdrawal.save();

  // Refund wallet
  const wallet = await RiderWallet.findById(withdrawal.wallet);
  if (wallet) {
    wallet.balance += withdrawal.amount;
    await wallet.save();
  }

  res.json({ message: "Withdrawal failed & refunded", withdrawal });
};
