const mongoose = require("mongoose");

const RiderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    vehicleType: {
      type: String,
      enum: ["bike", "car", "truck"],
      default: "bike",
    },

    profileImage: {
      url: String,
      publicId: String,
    },

    vehiclePlate: String,

    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: false },

    totalDeliveries: { type: Number, default: 0 },

    // ✅ coordinates required — no empty array allowed
    // Rider must send location before geo queries work
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined, // ✅ prevents empty [] being saved
      },
    },

    rating: { type: Number, default: 5 },

    bank: {
      accountName: String,
      accountNumber: String,
      bankName: String,
    },

    lastActiveAt: Date,
  },
  { timestamps: true }
);

// Sparse so riders without coordinates are excluded from geo index
// instead of causing index errors
RiderSchema.index({ currentLocation: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("Rider", RiderSchema);