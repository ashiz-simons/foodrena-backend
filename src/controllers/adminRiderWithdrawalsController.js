const RiderWithdrawal = require("../models/RiderWithdrawal");
const RiderWallet = require("../models/RiderWallet");

/**
 * Admin gets all rider withdrawals
 */
exports.getWithdrawals = async (req, res) => {
  try {
    const { status } = req.query; // ?status=pending
    const filter = status ? { status } : {};

    const withdrawals = await RiderWithdrawal.find(filter)
      .populate("rider", "name email phone")
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Admin marks withdrawal paid — releases pending funds permanently
 */
exports.markPaid = async (req, res) => {
  try {
    const withdrawal = await RiderWithdrawal.findById(req.params.id);

    if (!withdrawal)
      return res.status(404).json({ message: "Not found" });

    if (withdrawal.status !== "pending")
      return res.status(400).json({ message: `Already ${withdrawal.status}` });

    const wallet = await RiderWallet.findById(withdrawal.wallet);
    if (wallet) {
      wallet.pendingBalance = Math.max(0, wallet.pendingBalance - withdrawal.amount);
      await wallet.save();
    }

    withdrawal.status = "paid";
    withdrawal.paidAt = new Date();
    withdrawal.reference = `RIDER_PAYOUT_${Date.now()}`;
    await withdrawal.save();

    res.json({ message: "Withdrawal marked as paid", withdrawal });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Admin marks failed → refund pending back to available balance
 */
exports.markFailed = async (req, res) => {
  try {
    const withdrawal = await RiderWithdrawal.findById(req.params.id);

    if (!withdrawal)
      return res.status(404).json({ message: "Not found" });

    if (withdrawal.status !== "pending")
      return res.status(400).json({ message: `Already ${withdrawal.status}` });

    const wallet = await RiderWallet.findById(withdrawal.wallet);
    if (wallet) {
      wallet.pendingBalance = Math.max(0, wallet.pendingBalance - withdrawal.amount);
      wallet.balance += withdrawal.amount;
      await wallet.save();
    }

    withdrawal.status = "failed";
    withdrawal.failureReason = req.body.reason || "Transfer failed";
    await withdrawal.save();

    res.json({ message: "Withdrawal failed & funds refunded", withdrawal });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};