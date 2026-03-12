const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["percent", "free_delivery"],
      required: true,
    },
    discountPercent: {
      // only used when type === "percent"
      type: Number,
      min: 1,
      max: 100,
      default: null,
    },
    minOrder: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // who made it
    createdByRole: {
      type: String,
      enum: ["admin", "vendor"],
      required: true,
    },
    vendorId: {
      // null when admin-created
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    // tracks which user IDs have redeemed this promo
    usedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Promo", promoSchema);