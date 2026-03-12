const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type:        { type: String, enum: ["credit", "debit"], required: true },
  amount:      { type: Number, required: true },
  description: { type: String, default: "" },
  orderId:     { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  createdAt:   { type: Date, default: Date.now },
});

const customerWalletSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance:      { type: Number, default: 0 },
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomerWallet", customerWalletSchema);