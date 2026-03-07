const Rider = require("../models/Rider");
const Order = require("../models/Order");
const RiderWallet = require("../models/RiderWallet");
const RiderEarning = require("../models/RiderEarning");
const RiderTransaction = require("../models/RiderTransaction");
const cloudinary = require("../config/cloudinary");

exports.createRider = async (req, res) => {
  try {
    const existing = await Rider.findOne({ user: req.body.user });
    if (existing) return res.status(400).json({ message: "Rider already exists" });
    const rider = await Rider.create(req.body);
    res.json(rider);
  } catch (err) {
    res.status(500).json({ message: "Failed to create rider", error: err.message });
  }
};

exports.getRiders = async (req, res) => {
  try {
    const riders = await Rider.find().populate("user", "name email role");
    res.json(riders);
  } catch {
    res.status(500).json({ message: "Failed to fetch riders" });
  }
};

exports.getRider = async (req, res) => {
  try {
    const rider = await Rider.findById(req.params.id).populate("user");
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    res.json(rider);
  } catch {
    res.status(500).json({ message: "Error fetching rider" });
  }
};

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

exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "Lat & Lng required" });
    }

    const rider = req.rider;

    if (!rider.isAvailable) {
      return res.status(403).json({ message: "Inactive rider cannot update location" });
    }

    // ✅ Save as proper GeoJSON so $nearSphere queries work
    rider.currentLocation = {
      type: "Point",
      coordinates: [lng, lat], // GeoJSON order: [lng, lat]
    };
    rider.lastActiveAt = new Date();
    await rider.save();

    global.io?.emit("rider_location_update", { riderId: rider._id, lat, lng });
    global.io?.to(`rider_${rider._id}`).emit("rider_location_update", { lat, lng });

    await Order.updateMany(
      { rider: rider._id, status: { $in: ["rider_assigned", "on_the_way"] } },
      { $set: { riderLiveLocation: rider.currentLocation } }
    );

    res.json({ success: true, rider });
  } catch (err) {
    console.error("❌ updateLocation error:", err);
    res.status(500).json({ message: "Failed to update location", error: err.message });
  }
};

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
    order.status = "rider_assigned";
    await order.save();

    await Rider.findByIdAndUpdate(riderId, { isAvailable: false });

    global.io?.to(`rider_${rider._id}`).emit("new_order", order);
    global.io?.to(`order_${order._id}`).emit("order_status_update", order);

    res.json({ message: "Rider assigned", order });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign rider" });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const rider = req.rider;
    if (!rider) return res.status(404).json({ message: "Rider profile missing" });

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

    global.io?.to(`order_${order._id}`).emit("order_status_update", {
      orderId: order._id, status: order.status
    });
    res.json({ message: "Delivery accepted", order });
  } catch {
    res.status(500).json({ message: "Error accepting delivery" });
  }
};

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

    global.io?.to(`order_${order._id}`).emit("order_status_update", {
      orderId: order._id, status: order.status
    });
    res.json({ message: "Pickup confirmed", order });
  } catch {
    res.status(500).json({ message: "Failed to confirm pickup" });
  }
};

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

    global.io?.to(`order_${order._id}`).emit("order_status_update", {
      orderId: order._id, status: order.status
    });
    res.json({ message: "Trip started", order });
  } catch {
    res.status(500).json({ message: "Failed to start trip" });
  }
};

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

    // Atomic lock — prevents double payout
    const lockedOrder = await Order.findOneAndUpdate(
      { _id: order._id, riderPaid: { $ne: true }, completedAt: { $exists: false } },
      { $set: { riderPaid: true, status: "delivered", completedAt: new Date() } },
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
    if (!payoutExists) {
      const before = wallet.pendingBalance;

      const earning = await RiderEarning.create({
        rider: riderId,
        order: order._id,
        amount: DELIVERY_PAYOUT,
        status: "pending",
        availableAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      });

      wallet.pendingBalance += DELIVERY_PAYOUT;
      await wallet.save();

      await RiderTransaction.create({
        rider: riderId,
        type: "earning",
        amount: DELIVERY_PAYOUT,
        balanceBefore: before,
        balanceAfter: wallet.pendingBalance,
        reference: earning._id,
      });
    }

    // ✅ Free up the rider for new orders
    await Rider.findByIdAndUpdate(riderId, {
      isAvailable: true,
      lastActiveAt: new Date(),
    });
    console.log(`✅ Rider ${riderId} freed up after delivery`);

    global.io?.to(`order_${order._id}`).emit("order_status_update", {
      orderId: order._id,
      status: "delivered",
    });

    res.json({ message: "Delivery completed & payout recorded", order: lockedOrder });
  } catch (err) {
    res.status(500).json({ message: "Failed to complete delivery", error: err.message });
  }
};

exports.rejectDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.rider || order.rider.toString() !== req.rider._id.toString()) {
      return res.status(403).json({ message: "Not assigned" });
    }

    // ✅ Free up the rider when they reject
    await Rider.findByIdAndUpdate(order.rider, {
      isAvailable: true,
      lastActiveAt: new Date(),
    });

    order.rider = null;
    order.status = "searching_rider";
    order.assignmentAttempts += 1;
    await order.save();

    const { assignRiderToOrder } = require("../services/riderMatching");
    await assignRiderToOrder(order._id);

    res.json({ message: "Order reassigned" });
  } catch {
    res.status(500).json({ message: "Failed to reject delivery" });
  }
};

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

exports.getRiderDashboard = async (req, res) => {
  try {
    const rider = req.rider;
    if (!rider) return res.status(404).json({ message: "Rider profile missing" });

    const orders = await Order.find({ rider: rider._id }).sort({ createdAt: -1 });

    const earningsAgg = await RiderEarning.aggregate([
      { $match: { rider: rider._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      rider,
      orders,
      ordersToday: orders.length,
      earnings: earningsAgg[0]?.total || 0,
      isAvailable: rider.isAvailable,
    });
  } catch (err) {
    console.error("❌ Rider dashboard error:", err);
    res.status(500).json({ message: "Server error loading dashboard" });
  }
};

exports.updateProfileImage = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id });
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const { imageUrl, publicId } = req.body;
    if (!imageUrl || !publicId) return res.status(400).json({ message: "Image data required" });

    if (rider.profileImage?.publicId) {
      await cloudinary.uploader.destroy(rider.profileImage.publicId);
    }

    rider.profileImage = { url: imageUrl, publicId };
    await rider.save();

    res.json({ message: "Profile image updated", profileImage: rider.profileImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const { vehicleType, vehiclePlate } = req.body;
    const userId = req.user._id;

    let rider = await Rider.findOne({ user: userId });

    if (!rider) {
      rider = await Rider.create({
        user: userId,
        vehicleType,
        vehiclePlate,
        isAvailable: false,
        isActive: true,
        lastActiveAt: new Date(),
      });
    } else {
      rider.vehicleType = vehicleType;
      rider.vehiclePlate = vehiclePlate;
      await rider.save();
    }

    res.json({ message: "Vehicle info saved", rider });
  } catch (err) {
    console.error("UPDATE VEHICLE ERROR:", err);
    res.status(500).json({ message: "Failed to save vehicle info" });
  }
};