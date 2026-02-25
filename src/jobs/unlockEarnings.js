const Earning = require('../models/Earning');
const Wallet = require('../models/Wallet');

module.exports = async function unlockVendorEarnings() {
  try {
    const now = new Date();

    const earnings = await Earning.find({
      status: 'pending',
      availableAt: { $lte: now }
    });

    for (const earning of earnings) {
      // Skip if already processed (extra safety)
      if (earning.status !== 'pending') continue;

      const wallet = await Wallet.findOne({ vendor: earning.vendor });
      if (!wallet) continue;

      const amount = earning.netAmount || 0;
      if (amount <= 0) continue;

      // Prevent negative pending balance
      wallet.pendingBalance = Math.max(0, wallet.pendingBalance - amount);
      wallet.balance += amount;

      earning.status = 'available';

      await wallet.save();
      await earning.save();
    }

    if (earnings.length > 0) {
      console.log(`💰 Unlocked ${earnings.length} vendor earnings`);
    }

  } catch (err) {
    console.error("❌ Vendor earnings unlock failed:", err.message);
  }
};
