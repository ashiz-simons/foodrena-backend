const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    reference: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    failureReason: String,
    paidAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
