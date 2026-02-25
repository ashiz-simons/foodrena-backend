const mongoose = require("mongoose");

const RiderWithdrawalSchema = new mongoose.Schema({
  rider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RiderWallet",
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  },

  reference: String,

  failureReason: String,

  paidAt: Date
}, { timestamps: true });

module.exports = mongoose.model("RiderWithdrawal", RiderWithdrawalSchema);
