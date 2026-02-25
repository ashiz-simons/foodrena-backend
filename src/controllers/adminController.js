const Order = require('../models/Order');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');
const Vendor = require('../models/Vendor');
const Wallet = require('../models/Wallet');

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
    .populate('owner', 'name email')
    .sort('-createdAt');

  const enriched = await Promise.all(
    vendors.map(async (vendor) => {
      const totalOrders = await Order.countDocuments({ vendor: vendor._id });

      const completedOrders = await Order.countDocuments({
        vendor: vendor._id,
        status: 'delivered'
      });

      const revenueAgg = await Order.aggregate([
        { $match: { vendor: vendor._id, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);

      const revenue = revenueAgg[0]?.total || 0;

      const cancelRate = totalOrders
        ? (((totalOrders - completedOrders) / totalOrders) * 100).toFixed(1)
        : 0;

      const wallet = await Wallet.findOne({ vendor: vendor._id });

      return {
        ...vendor.toObject(),
        stats: {
          totalOrders,
          completedOrders,
          cancelRate,
          revenue,
          walletBalance: wallet?.balance || 0,
          pendingBalance: wallet?.pendingBalance || 0
        }
      };
    })
  );

  res.json(enriched);
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

exports.reinstateVendor = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    return res.status(404).json({ message: "Vendor not found" });
  }

  vendor.status = "verified";
  vendor.isOpen = true;
  await vendor.save();

  res.json({ message: "Vendor reinstated", vendor });
};
