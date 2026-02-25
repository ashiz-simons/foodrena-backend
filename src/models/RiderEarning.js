const mongoose = require("mongoose");

const RiderEarningSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true // Prevent duplicate payouts
    },

    amount: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "available", "paid"],
      default: "pending"
    },

    availableAt: {
      type: Date,
      required: true
    },

    paidAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiderEarning", RiderEarningSchema);
