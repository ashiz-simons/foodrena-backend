const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      url: String,
      publicId: String,
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const VendorSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
    },

    address: {
      street: String,
      city: String,
      state: String,
      country: String,
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        index: '2dsphere',
      },
    },

    documents: [
      {
        url: String,
        publicId: String,
      },
    ],

    status: {
      type: String,
      enum: ['pending', 'review', 'verified', 'rejected'],
      default: 'pending',
    },

    isOpen: {
      type: Boolean,
      default: false,
    },

    menuItems: [MenuItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', VendorSchema);
