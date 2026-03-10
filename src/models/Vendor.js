const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    price: { type: Number, required: true, min: 0 },
    image: { url: String, publicId: String },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const VendorSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
    businessName: { type: String, trim: true },
    logo: { url: String, publicId: String },
    phone: { type: String, required: true },
    address: { street: String, city: String, state: String, country: String },
    bank: { bankName: String, accountNumber: String, accountName: String },
    location: {
      type: { type: String, enum: ["Point"], required: true, default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    documents: [{ url: String, publicId: String }],
    status: {
      type: String,
      enum: ["pending", "review", "verified", "rejected"],
      default: "pending",
    },
    zone: { type: String },
    onboardingCompleted: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: false },
    menuItems: [MenuItemSchema],

    // ── Ratings ──────────────────────────────────────────────
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

VendorSchema.index({ location: "2dsphere" });
module.exports = mongoose.model("Vendor", VendorSchema);