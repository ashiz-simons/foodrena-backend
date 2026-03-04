const Order = require("../models/Order");
const Earning = require("../models/Earning");
const Wallet = require("../models/Wallet");
const Vendor = require("../models/Vendor");
const Withdrawal = require("../models/Withdrawal");

/**
 * ===============================
 * ORDERS
 * ===============================
 */

/**
 * GET all orders (admin)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("vendor", "businessName")
      .sort("-createdAt");

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

/**
 * ===============================
 * WITHDRAWALS
 * ===============================
 */

exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate("vendor", "businessName email")
      .sort("-createdAt");

    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
};

/**
 * ===============================
 * PLATFORM REVENUE
 * ===============================
 */

exports.getPlatformRevenue = async (req, res) => {
  try {
    const earnings = await Earning.find({});

    const totalPlatformProfit = earnings.reduce(
      (acc, item) => acc + (item.platformProfit || 0),
      0
    );

    const totalGross = earnings.reduce(
      (acc, item) => acc + (item.grossAmount || 0),
      0
    );

    res.json({
      totalPlatformProfit,
      totalGross,
      totalOrders: earnings.length
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to calculate revenue" });
  }
};

/**
 * ===============================
 * VENDORS
 * ===============================
 */

exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort("-createdAt");
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch vendors" });
  }
};

exports.verifyVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.status = "verified";
    vendor.isOpen = true; // optional if you want them active immediately

    await vendor.save();

    res.json({
      message: "Vendor verified successfully",
      vendor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify vendor" });
  }
};


exports.suspendVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.isSuspended = true;
    await vendor.save();

    res.json({ message: "Vendor suspended" });
  } catch (err) {
    res.status(500).json({ message: "Failed to suspend vendor" });
  }
};

exports.reinstateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.isSuspended = false;
    await vendor.save();

    res.json({ message: "Vendor reinstated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to reinstate vendor" });
  }
};