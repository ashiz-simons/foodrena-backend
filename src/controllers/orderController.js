const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const redis = require('../services/redis');

const { refundTransaction } = require('../services/payments/paystack');
const Earning = require('../models/Earning');
const Wallet = require('../models/Wallet');
const finalizeOrderSettlement = require("../services/finalizeOrderSettlement");
const { notifyCustomer } = require('../utils/notifyHelpers'); // ✅
const { calculateDeliveryFee } = require('../utils/deliveryFee');

async function safeFinalizeSettlement(orderId) {
  try {
    await finalizeOrderSettlement(orderId);
  } catch (err) {
    console.error("Finalize settlement failed:", err.message);
  }
}

const ORDER_EXPIRY_MS = 30 * 60 * 1000;
const VENDOR_ACCEPT_TIMEOUT_MS = 10 * 60 * 1000;

const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['searching_rider'],
  searching_rider: ['rider_assigned', 'cancelled'],
  rider_assigned: ['arrived_at_pickup', 'searching_rider'],
  arrived_at_pickup: ['picked_up'],
  picked_up: ['on_the_way'],
  on_the_way: ['delivered'],
};

// Push notification messages per status change
const STATUS_MESSAGES = {
  accepted:         { title: '✅ Order Accepted!',        body: 'Your order has been accepted by the vendor and is being prepared.' },
  preparing:        { title: '👨‍🍳 Order Being Prepared',  body: 'The vendor is now preparing your order.' },
  searching_rider:  { title: '🔍 Finding a Rider',        body: 'We are looking for a rider to deliver your order.' },
  rider_assigned:   { title: '🛵 Rider Assigned!',        body: 'A rider has been assigned to your order and is heading to pick it up.' },
  arrived_at_pickup:{ title: '📍 Rider at Vendor',        body: 'Your rider has arrived at the restaurant to pick up your order.' },
  picked_up:        { title: '🎁 Order Picked Up',        body: 'Your order has been picked up and is on its way!' },
  on_the_way:       { title: '🚀 On The Way!',            body: 'Your rider is on the way to deliver your order.' },
  delivered:        { title: '✅ Order Delivered!',       body: 'Your order has been delivered. Enjoy your meal! 🍽️' },
  cancelled:        { title: '❌ Order Cancelled',        body: 'Your order was cancelled. A refund will be processed if payment was made.' },
};

async function publish(event, payload) {
  if (!redis) return;
  try {
    await redis.publish(event, JSON.stringify(payload));
  } catch (err) {
    console.warn('Redis publish failed:', err.message);
  }
}

async function refundOrderIfNeeded(order, reason) {
  if (
    order.paymentStatus !== "paid" ||
    order.refundStatus === "refunded" ||
    order.refundStatus === "pending"
  ) return;

  order.refundStatus = "pending";
  order.refundReason = reason;
  await order.save();

  try {
    await refundTransaction(order.reference);

    const earning = await Earning.findOne({ order: order._id });

    if (earning && earning.status !== "reversed") {
      earning.status = "reversed";
      await earning.save();

      const wallet = await Wallet.findOne({ vendor: order.vendor });
      if (wallet) {
        wallet.pendingBalance = Math.max(0, wallet.pendingBalance - earning.netAmount);
        await wallet.save();
      }
    }

    order.vendorEarningRecorded = true;
    order.riderPaid = true;
    order.platformProfitRecorded = true;
    order.refundStatus = "refunded";
    order.refundedAt = new Date();
    await order.save();

  } catch {
    order.refundStatus = "failed";
    await order.save();
  }
}

function withExpiry(order) {
  const createdAt = order.createdAt.getTime();
  const now = Date.now();
  return {
    ...order.toObject(),
    paymentExpiresAt: new Date(createdAt + ORDER_EXPIRY_MS),
    vendorAcceptExpiresAt: new Date(createdAt + VENDOR_ACCEPT_TIMEOUT_MS),
    paymentExpiresInMs: Math.max(createdAt + ORDER_EXPIRY_MS - now, 0),
    vendorAcceptExpiresInMs: Math.max(createdAt + VENDOR_ACCEPT_TIMEOUT_MS - now, 0)
  };
}

async function expireIfUnpaid(order) {
  if (
    order.status === 'pending' &&
    order.paymentStatus === 'unpaid' &&
    Date.now() - order.createdAt.getTime() > ORDER_EXPIRY_MS
  ) {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    await publish('order.cancelled', { orderId: order._id, reason: 'payment_timeout' });
    return true;
  }
  return false;
}

async function expireIfVendorLate(order) {
  if (
    order.status === 'pending' &&
    Date.now() - order.createdAt.getTime() > VENDOR_ACCEPT_TIMEOUT_MS
  ) {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    await refundOrderIfNeeded(order, 'Vendor did not accept in time');

    // ✅ Push notify customer — vendor timed out
    await notifyCustomer(order.user, {
      title: '❌ Order Cancelled',
      body: 'The vendor did not accept your order in time. A refund has been initiated.',
      orderId: order._id,
    });

    await publish('order.cancelled', { orderId: order._id, reason: 'vendor_timeout' });
    return true;
  }
  return false;
}

/**
 * =======================
 * CREATE ORDER
 * =======================
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { vendorId, items, deliveryAddress, deliveryLocation } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: 'Order items required' });
    }

    const recentDuplicate = await Order.findOne({
      user: userId,
      vendor: vendorId,
      status: { $in: ['pending', 'accepted', 'preparing'] },
      createdAt: { $gte: new Date(Date.now() - 30 * 1000) },
    });

    if (recentDuplicate) {
      return res.status(409).json({
        message: 'Duplicate order detected. Please wait before placing another.',
        orderId: recentDuplicate._id,
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor || vendor.status !== 'verified') {
      return res.status(400).json({ message: 'Vendor unavailable' });
    }

    if (
      !vendor.location ||
      !vendor.location.coordinates ||
      vendor.location.coordinates.length !== 2
    ) {
      return res.status(400).json({ message: "Vendor missing location" });
    }

    if (!vendor.onboardingCompleted) {
      return res.status(400).json({ message: "Vendor onboarding incomplete" });
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = vendor.menuItems.id(item.menuItemId);
      if (!menuItem || !menuItem.available) {
        return res.status(400).json({ message: 'Invalid menu item' });
      }

      const quantity = Math.max(1, item.quantity || 1);
      subtotal += menuItem.price * quantity;

      orderItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity
      });
    }

    const [vendorLng, vendorLat] = vendor.location.coordinates;

    // Calculate delivery fee based on distance
    let deliveryFee = 500; // fallback if no location provided
    let customerLat = null;
    let customerLng = null;

    if (deliveryLocation?.lat && deliveryLocation?.lng) {
      customerLat = parseFloat(deliveryLocation.lat);
      customerLng = parseFloat(deliveryLocation.lng);
      deliveryFee = calculateDeliveryFee(vendorLat, vendorLng, customerLat, customerLng);
    }

    const total = subtotal + deliveryFee;

    const order = await Order.create({
      user: userId,
      vendor: vendorId,
      items: orderItems,
      subtotal,
      deliveryFee,
      total,
      deliveryAddress,
      deliveryLocation: customerLat && customerLng ? {
        type: 'Point',
        coordinates: [customerLng, customerLat],
      } : undefined,
      pickupLocation: {
        lat: vendorLat,
        lng: vendorLng,
        address: vendor.address?.street || "",
      },
      zone: vendor.zone,
      status: 'pending',
      assignmentAttempts: 0
    });

    await publish('order.created', {
      orderId: order._id,
      vendorId,
      userId,
      total,
      status: order.status
    });

    return res.status(201).json({
      message: 'Order created',
      order: withExpiry(order)
    });

  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * =======================
 * GET USER ORDERS
 * =======================
 */
exports.getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('vendor', 'name')
    .sort('-createdAt');

  for (const order of orders) {
    if (!(await expireIfVendorLate(order))) {
      await expireIfUnpaid(order);
    }
  }

  res.json(orders.map(withExpiry));
};

/**
 * =======================
 * GET VENDOR ORDERS
 * =======================
 */
exports.getVendorOrders = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) {
    return res.status(403).json({ message: 'Not a vendor' });
  }

  const orders = await Order.find({ vendor: vendor._id })
    .populate('user', 'name email')
    .sort('-createdAt');

  for (const order of orders) {
    if (!(await expireIfVendorLate(order))) {
      await expireIfUnpaid(order);
    }
  }

  res.json(orders.map(withExpiry));
};

/**
 * =======================
 * UPDATE ORDER STATUS
 * =======================
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (['cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ message: 'Order locked' });
    }

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor || order.vendor.toString() !== vendor._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Invalid transition ${order.status} → ${status}`
      });
    }

    if (
      ['preparing', 'searching_rider'].includes(status) &&
      order.paymentStatus !== 'paid'
    ) {
      return res.status(400).json({ message: 'Payment must be completed first' });
    }

    order.status = status;
    await order.save();

    if (status === 'searching_rider') {
      const { assignRiderToOrder } = require('../services/riderMatching');
      assignRiderToOrder(order._id);
    }

    if (status === 'delivered') {
      order.deliveredAt = new Date();

      if (order.rider) {
        const Rider = require('../models/Rider');
        await Rider.findByIdAndUpdate(order.rider, {
          isAvailable: true,
          lastActiveAt: new Date(),
        });
      }

      const earning = await Earning.findOne({ order: order._id });
      if (earning && earning.status === 'pending') {
        earning.status = 'available';
        await earning.save();

        const wallet = await Wallet.findOne({ vendor: order.vendor });
        if (wallet) {
          wallet.balance += earning.netAmount;
          wallet.pendingBalance = Math.max(0, wallet.pendingBalance - earning.netAmount);
          await wallet.save();
        }
      }

      await safeFinalizeSettlement(order._id);
    }

    await order.save();
    await publish('order.status.updated', { orderId: order._id, status });

    // Socket notify customer in real time
    global.io?.to(`order_${order._id}`).emit("order_status_update", {
      orderId: order._id,
      status,
    });

    // ✅ Push notify customer for every status change
    const msg = STATUS_MESSAGES[status];
    if (msg) {
      await notifyCustomer(order.user, {
        title: msg.title,
        body: msg.body,
        orderId: order._id,
      });
    }

    res.json({ message: 'Order status updated', order });

  } catch (err) {
    console.error('Update Order Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};