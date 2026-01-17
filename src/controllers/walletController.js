const Wallet = require('../models/Wallet');
const Vendor = require('../models/Vendor');
const Withdrawal = require('../models/Withdrawal');
const { initiateTransfer } = require('../services/payments/paystack');

exports.getMyWallet = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return res.status(403).json({ message: 'Not a vendor' });

  const wallet = await Wallet.findOne({ vendor: vendor._id });

  res.json(
    wallet || {
      balance: 0,
      pendingBalance: 0,
      currency: 'NGN'
    }
  );
};

exports.requestWithdrawal = async (req, res) => {
  const { amount, recipient } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return res.status(403).json({ message: 'Not a vendor' });

  const wallet = await Wallet.findOne({ vendor: vendor._id });
  if (!wallet || wallet.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }

  const reference = `WD_${vendor._id}_${Date.now()}`;

  // lock funds immediately
  wallet.balance -= amount;
  await wallet.save();

  const withdrawal = await Withdrawal.create({
    vendor: vendor._id,
    wallet: wallet._id,
    amount,
    reference
  });

  try {
    await initiateTransfer({
      amount,
      recipient,
      reference
    });

    res.json({
      message: 'Withdrawal initiated',
      withdrawal
    });
  } catch (err) {
    // rollback on failure
    wallet.balance += amount;
    await wallet.save();

    withdrawal.status = 'failed';
    withdrawal.failureReason = err.message;
    await withdrawal.save();

    res.status(500).json({ message: 'Transfer failed' });
  }
};

exports.withdraw = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) {
    return res.status(403).json({ message: 'Not a vendor' });
  }

  const wallet = await Wallet.findOne({ vendor: vendor._id });
  if (!wallet || wallet.balance <= 0) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }

  const amount = wallet.balance;

  // lock funds
  wallet.balance = 0;
  await wallet.save();

  const reference = `WD_${vendor._id}_${Date.now()}`;

  const withdrawal = await Withdrawal.create({
    vendor: vendor._id,
    wallet: wallet._id,
    amount,
    reference
  });

  try {
    await initiateTransfer({
      amount,
      recipient: vendor.paystackRecipientCode,
      reference
    });

    res.json({
      message: 'Withdrawal initiated',
      withdrawal
    });
  } catch (err) {
    // rollback
    wallet.balance = amount;
    await wallet.save();

    withdrawal.status = 'failed';
    withdrawal.failureReason = err.message;
    await withdrawal.save();

    res.status(500).json({ message: 'Transfer failed' });
  }
};
