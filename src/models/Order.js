const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  name: String,
  price: Number,
  quantity: {
    type: Number,
    default: 1,
    min: 1,
  },
});

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },

    items: [OrderItemSchema],

    subtotal: Number,
    deliveryFee: Number,
    total: Number,

    status: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'preparing',
        'dispatched',
        'delivered',
        'cancelled',
      ],
      default: 'pending',
    },

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },

    acceptedAt: Date,
    paidAt: Date,
    cancelledAt: Date,

    paymentProvider: {
      type: String,
      enum: ['stripe', 'paystack'],
      default: undefined,
    },

    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      lat: Number,
      lng: Number,
    },

    refundStatus: {
  type: String,
  enum: ['none', 
    'pending', 
    'refunded', 
    'failed'],
  default: 'none'
},
refundedAt: Date,
refundReason: String,

  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
