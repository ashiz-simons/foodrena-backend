const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  menuItemId: mongoose.Schema.Types.ObjectId,
  name: String,
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1, min: 1 },
});

const OrderSchema = new mongoose.Schema(
  {
    // ---------------- CORE ----------------
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: false, // allow null for package deliveries
    },

    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      default: null,
    },

    type: {
      type: String,
      enum: ['food', 'package'],
      default: 'food',
    },

    items: [OrderItemSchema],

    // ---------------- PRICING ----------------
    subtotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // Platform accounting
    platformFee: { type: Number, default: 0 },
    vendorNetAmount: { type: Number, default: 0 },
    riderPayout: { type: Number, default: 0 },

    // ---------------- PAYMENT ----------------
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },

    paymentProvider: {
      type: String,
      enum: ['stripe', 'paystack'],
    },

    paidAt: Date,

    // ---------------- DELIVERY FLOW ----------------
    status: {
      type: String,
      enum: [
        'pending',          // created
        'accepted',         // vendor accepted
        'preparing',        // vendor preparing
        'searching_rider',  
        'rider_assigned',
        'arrived_at_pickup',
        'picked_up',
        'on_the_way',
        'delivered',
        'cancelled',
      ],
      default: 'pending',
    },

    acceptedAt: Date,
    assignedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,

    // ---------------- LOCATIONS ----------------
    pickupLocation: {
      address: String,
      lat: Number,
      lng: Number,
    },

    dropoffLocation: {
      address: String,
      lat: Number,
      lng: Number,
    },

    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      lat: Number,
      lng: Number,
    },

    zone: {
      type: String,
      required: true,
      index: true
    },

    // ---------------- DISTANCE & ETA ----------------
    distanceKm: Number,
    estimatedTimeMinutes: Number,

    // ---------------- RIDER MATCHING ----------------
    assignmentAttempts: { type: Number, default: 0 },

    // ---------------- REFUNDS ----------------
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'refunded', 'failed'],
      default: 'none',
    },

    refundedAt: Date,
    refundReason: String,

    // ---------------- ACCOUNTING SAFETY FLAGS ----------------
    vendorEarningRecorded: { type: Boolean, default: false },
    riderPaid: { type: Boolean, default: false },
    platformProfitRecorded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
