const RiderWallet = require("../models/RiderWallet");
const RiderWithdrawal = require("../models/RiderWithdrawal");

/**
 * Rider requests withdrawal — creates pending request, admin approves
 */
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id; // protect middleware sets req.user

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    if (amount < 500)
      return res.status(400).json({ message: "Minimum withdrawal is ₦500" });

    const wallet = await RiderWallet.findOne({ rider: userId });
    if (!wallet)
      return res.status(404).json({ message: "Wallet not found" });

    if (wallet.balance < amount)
      return res.status(400).json({ message: "Insufficient balance" });

    // Lock funds — move to pending, don't delete yet
    wallet.balance -= amount;
    wallet.pendingBalance += amount;
    await wallet.save();

    const withdrawal = await RiderWithdrawal.create({
      rider: userId,
      wallet: wallet._id,
      amount,
      status: "pending",
    });

    res.json({
      message: "Withdrawal request submitted. Pending admin approval.",
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      withdrawal,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Rider views their withdrawal history
 */
exports.getMyWithdrawals = async (req, res) => {
  try {
    const userId = req.user._id;

    const withdrawals = await RiderWithdrawal.find({ rider: userId })
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch withdrawals", error: err.message });
  }
};