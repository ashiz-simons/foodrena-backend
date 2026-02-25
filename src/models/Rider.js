const mongoose = require("mongoose");

const RiderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    phone: String,

    vehicleType: {
      type: String,
      enum: ["bike", "car", "truck"],
      default: "bike",
    },

    vehiclePlate: String,

    isActive: {
      type: Boolean,
      default: true,
    },

    isAvailable: {
      type: Boolean,
      default: false,
    },

    totalDeliveries: {
      type: Number,
      default: 0,
    },

    currentLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    },

    rating: {
      type: Number,
      default: 5,
    },

    bank: {
      accountName: String,
      accountNumber: String,
      bankName: String
    },

    lastActiveAt: Date,
  },
  { timestamps: true }
);

RiderSchema.index({
   "currentLocation.lat": 1, 
   "currentLocation.lng": 1 
  });

module.exports = mongoose.model("Rider", RiderSchema);
