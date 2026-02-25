const RiderWallet = require("../models/RiderWallet");

/**
 * GET rider wallet
 */
exports.getMyWallet = async (req, res) => {
  try {
    const riderId = req.rider._id;

    let wallet = await RiderWallet.findOne({ rider: riderId });

    if (!wallet) {
      wallet = await RiderWallet.create({
        rider: riderId,
        balance: 0,
        pendingBalance: 0
      });
    }

    res.json(wallet);
  } catch (err) {
    res.status(500).json({
      message: "Failed to load wallet",
      error: err.message
    });
  }
};
