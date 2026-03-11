const Order = require("../models/Order");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

/**
 * 📊 Admin dashboard metrics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalVendors,
      totalUsers,
      revenueAgg,
      recentOrders,
      revenueChart,
      topVendorsRaw,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: "completed" }),
      Order.countDocuments({ status: "cancelled" }),
      User.countDocuments({ role: "vendor" }),
      User.countDocuments({ role: "user" }),

      Order.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
      ]),

      Order.find()
        .populate("user", "name email")
        .populate("vendor", "businessName")
        .sort("-createdAt")
        .limit(5),

      Order.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            amount: { $sum: "$totalAmount" },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
      ]),

      Order.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: "$vendor", revenue: { $sum: "$totalAmount" } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Populate vendor names for top vendors
    const vendorIds = topVendorsRaw.map(v => v._id);
    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("businessName");
    const vendorMap = {};
    vendors.forEach(v => { vendorMap[v._id.toString()] = v.businessName; });

    const topVendors = topVendorsRaw.map(v => ({
      _id: v._id,
      businessName: vendorMap[v._id?.toString()] || "Unknown",
      revenue: v.revenue,
    }));

    res.json({
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalVendors,
      totalUsers,
      totalRevenue: revenueAgg[0]?.totalRevenue || 0,
      recentOrders,
      revenueChart: revenueChart.map(d => ({ date: d._id, amount: d.amount })),
      topVendors,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
};