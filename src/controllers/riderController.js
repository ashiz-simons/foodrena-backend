const Rider = require("../models/Rider");
const Order = require("../models/Order");
const RiderWallet = require("../models/RiderWallet");
const RiderEarning = require("../models/RiderEarning");
const RiderTransaction = require("../models/RiderTransaction");

/**
 * CREATE rider profile (admin/manual)
 */
exports.createRider = async (req, res) => {
  try {
    const existing = await Rider.findOne({ user: req.body.user });
    if (existing) {
      return res.status(400).json({ message: "Rider already exists" });
    }

    const rider = await Rider.create(req.body);
    res.json(rider);
  } catch (err) {
    res.status(500).json({ message: "Failed to create rider", error: err.message });
  }
};

/**
 * GET all riders (admin)
 */
exports.getRiders = async (req, res) => {
  try {
    const riders = await Rider.find().populate("user", "name email role");
    res.json(riders);
  } catch {
    res.status(500).json({ message: "Failed to fetch riders" });
  }
};

/**
 * GET single rider
 */
exports.getRider = async (req, res) => {
  try {
    const rider = await Rider.findById(req.params.id).populate("user");
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    res.json(rider);
  } catch {
    res.status(500).json({ message: "Error fetching rider" });
  }
};

/**
 * UPDATE rider availability
 */
exports.updateAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    const rider = await Rider.findOneAndUpdate(
      { _id: req.rider._id },
      { isAvailable },
      { new: true }
    );

    if (!rider) return res.status(404).json({ message: "Rider profile not found" });

    res.json(rider);
  } catch {
    res.status(500).json({ message: "Failed to update availability" });
  }
};

/**
 * UPDATE rider live location
 */
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Lat & Lng required" });
    }

    const rider = req.rider;

    if (!rider.isAvailable) {
      return res.status(403).json({ message: "Inactive rider cannot update location" });
    }

    rider.currentLocation = { lat, lng };
    rider.lastActiveAt = new Date();
    await rider.save();

    // LIVE GPS STREAM
    global.io?.emit("rider_location_update", {
      riderId: rider._id,
      lat,
      lng
    });

    global.io?.to(`rider_${rider._id}`).emit("rider_location_update", {
      lat,
      lng
    });

    await Order.updateMany(
      { rider: rider._id, status: { $in: ["rider_assigned", "on_the_way"] } },
      { $set: { riderLiveLocation: rider.currentLocation } }
    );

    res.json({ success: true, rider });

  } catch (err) {
    res.status(500).json({ message: "Failed to update location", error: err.message });
  }
};

/**
 * ASSIGN rider to order (admin)
 */
exports.assignRider = async (req, res) => {
  try {
    const { riderId } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: "Order is locked" });
    }

    const rider = await Rider.findById(riderId);
    if (!rider || !rider.isAvailable) {
      return res.status(400).json({ message: "Rider unavailable" });
    }

    order.rider = rider._id;
    order.riderLiveLocation = rider.currentLocation;
    order.status = "rider_assigned";
    await order.save();

    global.io?.to(`order_${order._id}`).emit("order_status_update", order);

    res.json({ message: "Rider assigned", order });
  } catch {
    res.status(500).json({ message: "Failed to assign rider" });
  }
};

/**
 * GET rider orders
 */
exports.getMyOrders = async (req, res) => {
  try {
    const rider = req.rider;

    if (!rider) {
      return res.status(404).json({ message: "Rider profile missing" });
    }

    const orders = await Order.find({ rider: rider._id })
      .populate("user", "name email")
      .populate("vendor", "name")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("❌ Rider Orders Error:", err);
    res.status(500).json({ message: "Failed to fetch orders", error: err.message });
  }
};

/**
 * Rider accepts delivery
 */
exports.acceptDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.rider || order.rider.toString() !== req.rider._id.toString()) {
      return res.status(403).json({ message: "Not assigned to this order" });
    }

    if (order.status !== "rider_assigned") {
      return res.status(400).json({ message: "Order not in assignable state" });
    }

    order.status = "arrived_at_pickup";
    await order.save();

    global.io?.to(`order_${order._id}`).emit("order_status_update", order);
    res.json({ message: "Delivery accepted", order });
  } catch {
    res.status(500).json({ message: "Error accepting delivery" });
  }
};

/**
 * Rider marks pickup complete
 */
exports.markArrivedPickup = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.rider?.toString() !== req.rider._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status !== "arrived_at_pickup") {
      return res.status(400).json({ message: "Invalid state" });
    }

    order.status = "picked_up";
    await order.save();

    global.io?.to(`order_${order._id}`).emit("order_status_update", order);
    res.json({ message: "Pickup confirmed", order });
  } catch {
    res.status(500).json({ message: "Failed to confirm pickup" });
  }
};

/**
 * Rider starts trip
 */
exports.startTrip = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.rider?.toString() !== req.rider._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status !== "picked_up") {
      return res.status(400).json({ message: "Invalid order state" });
    }

    order.status = "on_the_way";
    await order.save();

    global.io?.to(`order_${order._id}`).emit("order_status_update", order);
    res.json({ message: "Trip started", order });
  } catch {
    res.status(500).json({ message: "Failed to start trip" });
  }
};

/**
 * Rider completes delivery
 */
exports.completeDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.rider?.toString() !== req.rider._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status !== "on_the_way") {
      return res.status(400).json({ message: "Delivery not active" });
    }

   // Atomic lock (prevents race condition)
const lockedOrder = await Order.findOneAndUpdate(
  {
    _id: order._id,
    riderPaid: { $ne: true },
    completedAt: { $exists: false }
  },
  {
    $set: {
      riderPaid: true,
      status: "delivered",
      completedAt: new Date()
    }
  },
  { new: true }
);

if (!lockedOrder) {
  return res.status(400).json({ message: "Order already completed or paid" });
}


    const riderId = order.rider;
    const DELIVERY_PAYOUT = order.deliveryFee || 500;

    let wallet = await RiderWallet.findOne({ rider: riderId });
    if (!wallet) wallet = await RiderWallet.create({ rider: riderId });

    const payoutExists = await RiderEarning.exists({ order: order._id });
    if (payoutExists) {
      return res.status(400).json({ message: "Payout already recorded" });
    }

    const before = wallet.pendingBalance;

    const earning = await RiderEarning.create({
      rider: riderId,
      order: order._id,
      amount: DELIVERY_PAYOUT,
      status: "pending",
      availableAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
    });

    wallet.pendingBalance += DELIVERY_PAYOUT;
    await wallet.save();

    await RiderTransaction.create({
      rider: riderId,
      type: "earning",
      amount: DELIVERY_PAYOUT,
      balanceBefore: before,
      balanceAfter: wallet.pendingBalance,
      reference: earning._id
    });

    global.io?.to(`order_${order._id}`).emit("order_status_update", order);

    res.json({ message: "Delivery completed & payout recorded", order });

  } catch (err) {
    res.status(500).json({ message: "Failed to complete delivery", error: err.message });
  }
};

/**
 * Rider rejects delivery → reassign
 */
exports.rejectDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.rider || order.rider.toString() !== req.rider._id.toString()) {
      return res.status(403).json({ message: "Not assigned" });
    }

    order.rider = null;
    order.status = "searching_rider";
    await order.save();

    const { assignRiderToOrder } = require("../services/riderMatching");
    await assignRiderToOrder(order._id);

    res.json({ message: "Order reassigned" });
  } catch {
    res.status(500).json({ message: "Failed to reject delivery" });
  }
};

/**
 * ADMIN — update rider active state
 */
exports.updateRiderStatus = async (req, res) => {
  try {
    const rider = await Rider.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    );

    if (!rider) return res.status(404).json({ message: "Rider not found" });

    res.json(rider);
  } catch (err) {
    res.status(500).json({ message: "Failed to update rider", error: err.message });
  }
};

(async () => {
  try {
    const test = await Rider.find().limit(1);
    console.log("Rider debug:", test);
  } catch {}
})();


/**************************
 * RIDER DASHBOARD
 **************************/
exports.getRiderDashboard = async (req, res) => {
  try {
    const rider = req.rider;

    if (!rider) {
      return res.status(404).json({ message: "Rider profile missing" });
    }

    const orders = await Order.find({
      rider: rider._id
    }).sort({ createdAt: -1 });

    const deliveredToday = await Order.countDocuments({
      rider: rider._id,
      status: "delivered",
      deliveredAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    const earningsAgg = await RiderEarning.aggregate([
      { $match: { rider: rider._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    res.json({
      rider,
      orders,
      ordersToday: orders.length,
      earnings: rider.totalEarnings || 0,
      isAvailable: rider.isAvailable
    });


  } catch (err) {
    console.error("❌ Rider dashboard error:", err);
    res.status(500).json({ message: "Server error loading dashboard" });
  }
};
