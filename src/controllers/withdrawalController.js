const Vendor = require('../models/Vendor');
const Wallet = require('../models/Wallet');
const Withdrawal = require('../models/Withdrawal');
const { initiateTransfer } = require('../services/payments/paystack');

exports.requestWithdrawal = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res.status(403).json({ message: 'Not a vendor' });
    }

    const wallet = await Wallet.findOne({ vendor: vendor._id });
    if (!wallet || wallet.balance <= 0) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const { amount } = req.body;
    if (!amount || amount > wallet.balance) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (!vendor.paystackRecipientCode) {
      return res.status(400).json({ message: 'No payout account set' });
    }

    // 🔒 Lock funds
    wallet.balance -= amount;
    await wallet.save();

    const withdrawal = await Withdrawal.create({
      vendor: vendor._id,
      wallet: wallet._id,
      amount,
      status: 'processing'
    });

    const reference = `WD_${withdrawal._id}_${Date.now()}`;

    try {
      await initiateTransfer({
        amount,
        recipient: vendor.paystackRecipientCode,
        reference
      });

      withdrawal.status = 'paid';
      withdrawal.reference = reference;
      withdrawal.paidAt = new Date();
      await withdrawal.save();

      res.json({ message: 'Withdrawal successful', withdrawal });
    } catch (err) {
      // 🔁 Rollback
      wallet.balance += amount;
      await wallet.save();

      withdrawal.status = 'failed';
      withdrawal.failureReason = err.message;
      await withdrawal.save();

      throw err;
    }
  } catch (err) {
    console.error('requestWithdrawal error:', err);
    res.status(500).json({ message: 'Withdrawal failed' });
  }
};
