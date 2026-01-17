const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const redis = require('../services/redis');

const { refundTransaction } = require('../services/payments/paystack');
const Earning = require('../models/Earning');
const Wallet = require('../models/Wallet');

/**
 * =======================
 * TIMEOUTS
 * =======================
 */
const ORDER_EXPIRY_MS = 30 * 60 * 1000;           // 30 mins payment window
const VENDOR_ACCEPT_TIMEOUT_MS = 10 * 60 * 1000; // 10 mins vendor accept

/**
 * =======================
 * ORDER FLOW RULES
 * =======================
 */
const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing'],
  preparing: ['dispatched'],
  dispatched: ['delivered']
};

/**
 * =======================
 * SAFE REDIS PUBLISH
 * =======================
 */
async function publish(event, payload) {
  if (!redis) return;
  try {
    await redis.publish(event, JSON.stringify(payload));
  } catch (_) {}
}

/**
 * =======================
 * REFUND HELPER (IDEMPOTENT)
 * =======================
 */
async function refundOrderIfNeeded(order, reason) {
  if (
    order.paymentStatus !== 'paid' ||
    order.refundStatus === 'refunded' ||
    order.paymentProvider !== 'paystack'
  ) {
    return;
  }

  order.refundStatus = 'pending';
  order.refundReason = reason;
  await order.save();

  try {
    await refundTransaction(order.reference);

    const earning = await Earning.findOne({ order: order._id });
    if (earning && earning.status !== 'reversed') {
      earning.status = 'reversed';
      await earning.save();

      const wallet = await Wallet.findOne({ vendor: order.vendor });
      if (wallet) {
        wallet.pendingBalance = Math.max(
          0,
          wallet.pendingBalance - earning.netAmount
        );
        await wallet.save();
      }
    }

    order.refundStatus = 'refunded';
    order.refundedAt = new Date();
    await order.save();
  } catch (err) {
    order.refundStatus = 'failed';
    await order.save();
  }
}

/**
 * =======================
 * EXPIRY HELPERS
 * =======================
 */
function withExpiry(order) {
  const createdAt = order.createdAt.getTime();
  const now = Date.now();

  return {
    ...order.toObject(),
    paymentExpiresAt: new Date(createdAt + ORDER_EXPIRY_MS),
    vendorAcceptExpiresAt: new Date(createdAt + VENDOR_ACCEPT_TIMEOUT_MS),
    paymentExpiresInMs: Math.max(createdAt + ORDER_EXPIRY_MS - now, 0),
    vendorAcceptExpiresInMs: Math.max(
      createdAt + VENDOR_ACCEPT_TIMEOUT_MS - now,
      0
    )
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

    await publish('order.cancelled', {
      orderId: order._id,
      reason: 'payment_timeout'
    });

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

    await publish('order.cancelled', {
      orderId: order._id,
      reason: 'vendor_timeout'
    });

    return true;
  }
  return false;
}

/**
 * =======================
 * CREATE ORDER (USER)
 * =======================
 */
exports.createOrder = async (req, res) => {
  const userId = req.user._id;
  const { vendorId, items, deliveryAddress } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ message: 'Order items required' });
  }

  const vendor = await Vendor.findById(vendorId);
  if (!vendor || vendor.status !== 'verified') {
    return res.status(400).json({ message: 'Vendor unavailable' });
  }

  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const menuItem = vendor.menuItems.id(item.menuItemId);
    if (!menuItem || !menuItem.available) {
      return res.status(400).json({ message: 'Invalid menu item' });
    }

    const quantity = item.quantity || 1;
    subtotal += menuItem.price * quantity;

    orderItems.push({
      menuItemId: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity
    });
  }

  const deliveryFee = 500;
  const total = subtotal + deliveryFee;

  const order = await Order.create({
    user: userId,
    vendor: vendorId,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    deliveryAddress,
    status: 'pending'
  });

  await publish('order.created', {
    orderId: order._id,
    vendorId,
    userId,
    total,
    status: order.status
  });

  res.status(201).json({
    message: 'Order created',
    order: withExpiry(order)
  });
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
 * UPDATE ORDER STATUS (VENDOR)
 * =======================
 */
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Vendor ownership check
  if (order.vendor.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // 🚨 ONLY enforce payment AFTER acceptance
  if (
    ['preparing', 'completed'].includes(status) &&
    order.paymentStatus !== 'paid'
  ) {
    return res.status(400).json({
      message: 'Payment must be made before continuing'
    });
  }

  order.status = status;
  await order.save();

  res.json({
    message: 'Order status updated',
    order
  });
};
