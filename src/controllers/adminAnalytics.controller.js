const Order = require("../models/Order");
const User = require("../models/User");

/**
 * 📊 Admin dashboard metrics
 */
exports.getDashboardStats = async (req, res) => {
  const [
    totalOrders,
    completedOrders,
    cancelledOrders,
    totalVendors,
    totalUsers,
    revenueAgg,
    recentOrders,
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
      .sort("-createdAt")
      .limit(5)
      .select("status totalAmount createdAt"),
  ]);

  res.json({
    totalOrders,
    completedOrders,
    cancelledOrders,
    totalVendors,
    totalUsers,
    totalRevenue: revenueAgg[0]?.totalRevenue || 0,
    recentOrders,
  });
};
