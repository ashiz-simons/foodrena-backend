const Wallet = require('../models/Wallet');
const Vendor = require('../models/Vendor');
const Withdrawal = require('../models/Withdrawal');

/**
 * GET MY WALLET — includes bank details
 */
exports.getMyWallet = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return res.status(403).json({ message: 'Not a vendor' });

    let wallet = await Wallet.findOne({ vendor: vendor._id });
    if (!wallet) {
      wallet = await Wallet.create({
        vendor: vendor._id,
        balance: 0,
        pendingBalance: 0,
        currency: 'NGN',
      });
    }

    res.json({
      ...wallet.toObject(),
      bank: vendor.bank ?? null, // { bankName, accountNumber, accountName }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * GET WITHDRAWAL HISTORY
 */
exports.getWithdrawals = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return res.status(403).json({ message: 'Not a vendor' });

    const withdrawals = await Withdrawal.find({ vendor: vendor._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * REQUEST WITHDRAWAL — creates pending request, admin approves and pays manually
 */
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Invalid amount' });

    if (amount < 500)
      return res.status(400).json({ message: 'Minimum withdrawal is ₦500' });

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return res.status(403).json({ message: 'Not a vendor' });

    if (!vendor.bank?.accountNumber)
      return res.status(400).json({
        message: 'Please add your bank details before withdrawing',
      });

    let wallet = await Wallet.findOne({ vendor: vendor._id });
    if (!wallet)
      return res.status(404).json({ message: 'Wallet not found' });

    if (wallet.balance < amount)
      return res.status(400).json({ message: 'Insufficient balance' });

    // Lock funds — move to pending, don't delete
    wallet.balance -= amount;
    wallet.pendingBalance += amount;
    await wallet.save();

    const reference = `WD_${vendor._id}_${Date.now()}`;

    const withdrawal = await Withdrawal.create({
      vendor: vendor._id,
      wallet: wallet._id,
      amount,
      reference,
      status: 'pending',
    });

    res.json({
      message: 'Withdrawal request submitted. Pending admin approval.',
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      withdrawal,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};