const Earning = require('../models/Earning');
const Wallet = require('../models/Wallet');

module.exports = async () => {
  const earnings = await Earning.find({
    status: 'pending',
    availableAt: { $lte: new Date() }
  });

  for (const earning of earnings) {
    const wallet = await Wallet.findOne({ vendor: earning.vendor });
    if (!wallet) continue;

    wallet.pendingBalance -= earning.netAmount;
    wallet.balance += earning.netAmount;

    earning.status = 'available';

    await wallet.save();
    await earning.save();
  }
};
