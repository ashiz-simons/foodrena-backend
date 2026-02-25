const mongoose = require('mongoose');

const EarningSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', unique: true },

    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

    grossAmount: Number,     // order subtotal
    platformFee: Number,     // commission
    netAmount: Number,       // vendor payout

    // ✅ NEW — Profit analytics
    deliveryFee: Number,
    platformProfit: Number,

    status: {
      type: String,
      enum: ['pending', 'available', 'paid', 'refunded'],
      default: 'pending'
    },

    availableAt: Date,
    paidAt: Date,
    refundedAt: Date,

  },
  { timestamps: true }
);

module.exports = mongoose.model('Earning', EarningSchema);
