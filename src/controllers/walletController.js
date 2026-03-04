const Wallet = require('../models/Wallet');
const Vendor = require('../models/Vendor');
const Withdrawal = require('../models/Withdrawal');
const { initiateTransfer } = require('../services/payments/paystack');

/**
 * GET MY WALLET
 */
exports.getMyWallet = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return res.status(403).json({ message: 'Not a vendor' });

  let wallet = await Wallet.findOne({ vendor: vendor._id });

  if (!wallet) {
    wallet = await Wallet.create({
      vendor: vendor._id,
      balance: 0,
      pendingBalance: 0,
      currency: 'NGN'
    });
  }

  res.json(wallet);
};

/**
 * REQUEST WITHDRAWAL
 */
exports.requestWithdrawal = async (req, res) => {
  const { amount, recipient } = req.body;

  if (!amount || amount <= 0)
    return res.status(400).json({ message: 'Invalid amount' });

  if (amount < 500)
    return res.status(400).json({ message: 'Minimum withdrawal is ₦500' });

  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return res.status(403).json({ message: 'Not a vendor' });

  const wallet = await Wallet.findOne({ vendor: vendor._id });
  if (!wallet || wallet.balance < amount)
    return res.status(400).json({ message: 'Insufficient balance' });

  const reference = `WD_${vendor._id}_${Date.now()}`;

  // Lock funds
  wallet.balance -= amount;
  wallet.pendingBalance += amount;
  await wallet.save();

  const withdrawal = await Withdrawal.create({
    vendor: vendor._id,
    wallet: wallet._id,
    amount,
    reference,
    status: 'pending'
  });

  try {
    await initiateTransfer({
      amount,
      recipient: recipient || vendor.paystackRecipientCode,
      reference
    });

    res.json({ message: 'Withdrawal initiated', withdrawal });

  } catch (err) {
    // ✅ CORRECT ROLLBACK
    wallet.pendingBalance -= amount;
    wallet.balance += amount;
    await wallet.save();

    withdrawal.status = 'failed';
    withdrawal.failureReason = err.message;
    await withdrawal.save();

    res.status(500).json({ message: 'Transfer failed' });
  }
};