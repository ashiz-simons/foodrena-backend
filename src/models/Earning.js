const mongoose = require('mongoose');

const EarningSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },

    grossAmount: {
      type: Number,
      required: true
    },

    platformFee: {
      type: Number,
      required: true
    },

    netAmount: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ['pending', 'available', 'paid', 'refunded'],
      default: 'pending'
    },

    availableAt: Date,
    paidAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Earning', EarningSchema);
