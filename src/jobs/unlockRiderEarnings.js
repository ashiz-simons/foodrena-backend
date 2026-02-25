const RiderEarning = require("../models/RiderEarning");
const RiderWallet = require("../models/RiderWallet");

module.exports = async function unlockRiderEarnings() {
  try {
    const now = new Date();

    const earnings = await RiderEarning.find({
      status: "pending",
      availableAt: { $lte: now }
    });

    for (const earning of earnings) {
      const wallet = await RiderWallet.findOne({ rider: earning.rider });
      if (!wallet) continue;

      wallet.pendingBalance = Math.max(0, wallet.pendingBalance - earning.amount);
      wallet.balance += earning.amount;
      wallet.totalEarned += earning.amount;

      earning.status = "available";

      await wallet.save();
      await earning.save();
    }

    if (earnings.length > 0) {
      console.log(`💰 Unlocked ${earnings.length} rider earnings`);
    }

  } catch (err) {
    console.error("❌ Rider earnings unlock failed:", err.message);
  }
};
