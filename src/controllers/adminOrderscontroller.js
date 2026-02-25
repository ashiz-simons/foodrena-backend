const Order = require("../models/Order");
const VendorWallet = require("../models/Wallet");

/**
 * GET all orders (admin)
 */
exports.getAllOrders = async (req, res) => {
  const orders = await Order.find()
    .populate("user", "name email")
    .populate("vendor", "businessName")
    .sort("-createdAt");

  res.json(orders);
};

/**
 * ❌ Cancel order (ADMIN)
 */
exports.cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (["completed", "cancelled"].includes(order.status)) {
    return res.status(400).json({ message: "Order already finalized" });
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();

  await order.save();

  res.json({ message: "Order cancelled" });
};

/**
 * ✅ Force complete order (ADMIN)
 */
exports.forceCompleteOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.status === "completed") {
    return res.status(400).json({ message: "Order already completed" });
  }

  order.status = "completed";
  order.paymentStatus = "paid";
  order.completedAt = new Date();

  await order.save();

  // Optional: credit vendor wallet if you use it
  if (order.vendorEarning) {
    await VendorWallet.updateOne(
      { vendor: order.vendor },
      {
        $inc: {
          balance: order.vendorEarning,
          availableBalance: order.vendorEarning,
        },
      }
    );
  }

  res.json({ message: "Order force completed" });
};
