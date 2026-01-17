const mongoose = require('mongoose');

const EarningSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      unique: true,
      required: true
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },

    grossAmount: Number,
    platformFee: Number,
    netAmount: Number,

    status: {
      type: String,
      enum: ['pending', 'available', 'paid'],
      default: 'pending'
    },

    availableAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Earning', EarningSchema);
