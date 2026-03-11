const RiderWallet = require("../models/RiderWallet");
const Rider = require("../models/Rider");

/**
 * GET rider wallet — uses req.user._id (protect middleware)
 */
exports.getMyWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    let wallet = await RiderWallet.findOne({ rider: userId });

    if (!wallet) {
      wallet = await RiderWallet.create({
        rider: userId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
      });
    }

    // Also return bank details from Rider profile
    const rider = await Rider.findOne({ user: userId }).select("bank");

    res.json({
      ...wallet.toObject(),
      bank: rider?.bank ?? null, // { bankName, accountNumber, accountName }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load wallet", error: err.message });
  }
};