const Order = require('../models/Order');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');
const Vendor = require('../models/Vendor');

/**
 * =======================
 * ORDERS
 * =======================
 */
exports.getAllOrders = async (req, res) => {
  const orders = await Order.find()
    .populate('user', 'name email')
    .populate('vendor', 'businessName')
    .sort('-createdAt');

  res.json(orders);
};

/**
 * =======================
 * EARNINGS
 * =======================
 */
exports.getAllEarnings = async (req, res) => {
  const earnings = await Earning.find()
    .populate('vendor', 'businessName')
    .populate('order')
    .sort('-createdAt');

  res.json(earnings);
};

/**
 * =======================
 * WITHDRAWALS
 * =======================
 */
exports.getAllWithdrawals = async (req, res) => {
  const withdrawals = await Withdrawal.find()
    .populate('vendor', 'businessName')
    .sort('-createdAt');

  res.json(withdrawals);
};

/**
 * =======================
 * PLATFORM REVENUE
 * =======================
 */
exports.getPlatformRevenue = async (req, res) => {
  const earnings = await Earning.find({
    status: { $ne: 'reversed' }
  });

  const revenue = earnings.reduce(
    (sum, e) => sum + e.platformFee,
    0
  );

  res.json({
    totalRevenue: revenue,
    currency: 'NGN'
  });
};

/**
  * =======================
  * GET ALL VENDORS ✅   
  * =======================
  */
exports.getAllVendors = async (req, res) => {
  const vendors = await Vendor.find()
    .populate('owner', 'name email');

  res.json(vendors);
};

/**
 * =======================
 * VERIFY VENDOR ✅
 * =======================
 */
exports.verifyVendor = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    return res.status(404).json({ message: 'Vendor not found' });
  }

  vendor.status = 'verified';
  vendor.isOpen = true;
  await vendor.save();

  res.json({
    message: 'Vendor verified successfully',
    vendor
  });
};

exports.suspendVendor = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    return res.status(404).json({ message: "Vendor not found" });
  }

  vendor.status = "suspended";
  vendor.isOpen = false;
  await vendor.save();

  res.json({ message: "Vendor suspended", vendor });
};

