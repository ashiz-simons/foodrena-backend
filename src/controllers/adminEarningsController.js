const Order = require("../models/Order");
const Earning = require("../models/Earning");

/**
 * ============================
 * ADMIN SUMMARY CARDS
 * ============================
 */
exports.getAdminEarnings = async (req, res) => {
  const earnings = await Earning.find({
    status: { $nin: ["refunded", "reversed"] }
  });

  let gross = 0;
  let platform = 0;
  let vendor = 0;

  for (const e of earnings) {
    gross += e.grossAmount || 0;
    platform += e.platformFee || 0;
    vendor += e.netAmount || 0;
  }

  const completedOrders = await Order.countDocuments({
    status: "delivered",
    refundStatus: "none"
  });

  res.json({
    totalRevenue: gross,
    platformEarnings: platform,
    vendorEarnings: vendor,
    completedOrders
  });
};


/**
 * ============================
 * EARNINGS CHART + RANGE DATA
 * ============================
 */
exports.getEarnings = async (req, res) => {
  const { range = "week" } = req.query;

  let startDate = new Date(0);
  const now = new Date();

  if (range === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }

  if (range === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  }

  if (range === "month") {
    startDate = new Date();
    startDate.setDate(1);
  }

  // Pull from earnings ledger (not orders)
  const earnings = await Earning.find({
    createdAt: { $gte: startDate },
    status: { $ne: "reversed" }
  });

  const dailyMap = {};

  earnings.forEach(e => {
    const dateKey = e.createdAt.toISOString().split("T")[0];

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        gross: 0,
        platform: 0,
        vendor: 0
      };
    }

    dailyMap[dateKey].gross += e.grossAmount || 0;
    dailyMap[dateKey].platform += e.platformFee || 0;
    dailyMap[dateKey].vendor += e.netAmount || 0;
  });

  const chartData = Object.keys(dailyMap).map(date => ({
    date,
    gross: dailyMap[date].gross,
    platform: dailyMap[date].platform,
    vendor: dailyMap[date].vendor
  }));

  const totals = chartData.reduce(
    (acc, d) => {
      acc.gross += d.gross;
      acc.platform += d.platform;
      acc.vendor += d.vendor;
      return acc;
    },
    { gross: 0, platform: 0, vendor: 0 }
  );

  const completedOrders = await Order.countDocuments({
    status: "delivered",
    paymentStatus: "paid",
    refundStatus: "none",
    createdAt: { $gte: startDate }
  });

  res.json({
    totalRevenue: totals.gross,
    platformEarnings: totals.platform,
    vendorEarnings: totals.vendor,
    completedOrders,
    chartData
  });
};
