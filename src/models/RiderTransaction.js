const mongoose = require("mongoose");

const RiderTransactionSchema = new mongoose.Schema({
  rider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  type: {
    type: String,
    enum: ["earning", "release", "withdrawal", "refund"]
  },

  amount: Number,

  balanceBefore: Number,
  balanceAfter: Number,

  reference: String
}, { timestamps: true });

module.exports = mongoose.model("RiderTransaction", RiderTransactionSchema);
