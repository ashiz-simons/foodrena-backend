const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["customer", "support"], required: true },
  text:   { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

const supportTicketSchema = new mongoose.Schema(
  {
    customer:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId:   { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    category:  {
      type: String,
      enum: ["refund", "delivery", "payment", "account", "other"],
      required: true,
    },
    subject:   { type: String, required: true, trim: true },
    status:    { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open" },
    messages:  [messageSchema],
    // Quick reference — first customer message
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportTicket", supportTicketSchema);