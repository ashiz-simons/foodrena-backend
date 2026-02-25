const Order = require("../models/Order");
const User = require("../models/User");
const Rider = require("../models/Rider");
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
    revenueChart,
    topVendors,
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

    Order.find().sort("-createdAt").limit(5),

    Order.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          amount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 14 },
    ]),

    Order.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$vendor",
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
  ]);

  res.json({
    totalOrders,
    completedOrders,
    cancelledOrders,
    totalVendors,
    totalUsers,
    totalRevenue: revenueAgg[0]?.totalRevenue || 0,
    recentOrders,
    revenueChart: revenueChart.map(d => ({
      date: d._id,
      amount: d.amount,
    })),
    topVendors,
  });
};