const Withdrawal = require("../models/Withdrawal");
const Wallet = require("../models/Wallet");

/**
 * GET all withdrawals
 */
exports.getAllWithdrawals = async (req, res) => {
  const withdrawals = await Withdrawal.find()
    .populate("vendor", "name email")
    .populate("wallet", "balance pendingBalance")
    .sort({ createdAt: -1 });

  res.json(withdrawals);
};

/**
 * MARK withdrawal as PAID
 */
exports.markAsPaid = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal || withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Invalid withdrawal" });
    }

    const wallet = await Wallet.findById(withdrawal.wallet);

    // Only deduct pending if wallet exists
    if (wallet) {
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - withdrawal.amount
      );
      await wallet.save();
    }

    withdrawal.status = "paid";
    withdrawal.paidAt = new Date();

    await withdrawal.save();

    res.json({ message: "Withdrawal marked as paid", withdrawal });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as paid", error: err.message });
  }
};

/**
 * MARK withdrawal as FAILED
 */
exports.markAsFailed = async (req, res) => {
  try {
    const { reason } = req.body;

    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal || withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Invalid withdrawal" });
    }

    const wallet = await Wallet.findById(withdrawal.wallet);

    // Refund safely if wallet exists
    if (wallet) {
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - withdrawal.amount
      );
      wallet.balance += withdrawal.amount;
      await wallet.save();
    }

    withdrawal.status = "failed";
    withdrawal.failureReason = reason || "Transfer failed";

    await withdrawal.save();

    res.json({
      message: "Withdrawal failed & funds refunded",
      withdrawal
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as failed", error: err.message });
  }
};
