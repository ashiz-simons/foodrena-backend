const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      unique: true,
      required: true
    },

    balance: {
      type: Number,
      default: 0 // available balance
    },

    pendingBalance: {
      type: Number,
      default: 0 // not yet withdrawable
    },

    currency: {
      type: String,
      default: 'NGN'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', WalletSchema);
