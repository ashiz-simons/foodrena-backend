const mongoose = require("mongoose");

const RiderWalletSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
      index: true
    },

    // Available to withdraw
    balance: {
      type: Number,
      default: 0
    },

    // Locked earnings (12h release delay)
    pendingBalance: {
      type: Number,
      default: 0
    },

    // Lifetime tracking (NEW — analytics safe)
    totalEarned: {
      type: Number,
      default: 0
    },

    currency: {
      type: String,
      default: "NGN"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiderWallet", RiderWalletSchema);
