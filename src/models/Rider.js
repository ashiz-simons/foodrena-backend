const mongoose = require("mongoose");

const RiderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    vehicleType: { type: String, enum: ["bike", "car", "truck"], default: "bike" },
    profileImage: { url: String, publicId: String },
    vehiclePlate: String,
    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: false },
    totalDeliveries: { type: Number, default: 0 },
    currentLocation: {
      type: { type: String, enum: ["Point"] }, // ← removed default: "Point"
      coordinates: { type: [Number] },         // ← removed default: undefined
    },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    bank: { accountName: String, accountNumber: String, bankName: String },
    lastActiveAt: Date,
  },
  { timestamps: true }
);

// sparse: true means the index ignores documents where currentLocation is null/missing
RiderSchema.index({ currentLocation: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("Rider", RiderSchema);