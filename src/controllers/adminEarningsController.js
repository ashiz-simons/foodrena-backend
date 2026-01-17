const Order = require("../models/Order");

/**
 * GET /api/admin/earnings
 * Query: ?range=today|week|month
 */
exports.getEarnings = async (req, res) => {
  try {
    const range = req.query.range || "week";

    const now = new Date();
    let startDate = new Date(0);

    if (range === "today") {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    }

    if (range === "week") {
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
    }

    if (range === "month") {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 1);
    }

    const match = {
      status: "completed",
      createdAt: { $gte: startDate },
    };

    /* =========================
       SUMMARY
    ========================= */
    const summary = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          completedOrders: { $sum: 1 },
        },
      },
    ]);

    const totals = summary[0] || {
      totalRevenue: 0,
      completedOrders: 0,
    };

    const COMMISSION_RATE = 0.1;

    const platformEarnings =
      totals.totalRevenue * COMMISSION_RATE;

    const vendorEarnings =
      totals.totalRevenue - platformEarnings;

    /* =========================
       DAILY CHART DATA
    ========================= */
    const daily = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          amount: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalRevenue: totals.totalRevenue,
      platformEarnings,
      vendorEarnings,
      completedOrders: totals.completedOrders,
      daily: daily.map(d => ({
        date: d._id,
        amount: d.amount,
      })),
    });
  } catch (err) {
    console.error("Earnings error:", err);
    res.status(500).json({ message: "Failed to load earnings" });
  }
};
