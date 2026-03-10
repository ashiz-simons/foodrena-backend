const Rating = require("../models/Rating");
const Order = require("../models/Order");
const Vendor = require("../models/Vendor");
const Rider = require("../models/Rider");

/**
 * POST /ratings
 * Submit a rating for vendor and/or rider after delivery
 * Body: { orderId, vendorScore, vendorComment, riderScore, riderComment }
 */
exports.submitRating = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId, vendorScore, vendorComment, riderScore, riderComment } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.user.toString() !== userId.toString())
      return res.status(403).json({ message: "Not your order" });
    if (order.status !== "delivered")
      return res.status(400).json({ message: "Order not yet delivered" });

    const results = {};

    // Rate vendor (food orders only)
    if (vendorScore && order.vendor) {
      const existing = await Rating.findOne({
        order: orderId, customer: userId, targetType: "vendor",
      });
      if (existing) {
        results.vendor = { skipped: true, reason: "Already rated" };
      } else {
        await Rating.create({
          order: orderId,
          customer: userId,
          targetType: "vendor",
          target: order.vendor,
          score: vendorScore,
          comment: vendorComment || "",
        });
        // Recalculate vendor average
        const agg = await Rating.aggregate([
          { $match: { targetType: "vendor", target: order.vendor } },
          { $group: { _id: null, avg: { $avg: "$score" }, count: { $sum: 1 } } },
        ]);
        if (agg.length > 0) {
          await Vendor.findByIdAndUpdate(order.vendor, {
            rating: Math.round(agg[0].avg * 10) / 10,
            ratingCount: agg[0].count,
          });
        }
        results.vendor = { success: true, score: vendorScore };
      }
    }

    // Rate rider
    if (riderScore && order.rider) {
      const existing = await Rating.findOne({
        order: orderId, customer: userId, targetType: "rider",
      });
      if (existing) {
        results.rider = { skipped: true, reason: "Already rated" };
      } else {
        await Rating.create({
          order: orderId,
          customer: userId,
          targetType: "rider",
          target: order.rider,
          score: riderScore,
          comment: riderComment || "",
        });
        // Recalculate rider average
        const agg = await Rating.aggregate([
          { $match: { targetType: "rider", target: order.rider } },
          { $group: { _id: null, avg: { $avg: "$score" }, count: { $sum: 1 } } },
        ]);
        if (agg.length > 0) {
          await Rider.findByIdAndUpdate(order.rider, {
            rating: Math.round(agg[0].avg * 10) / 10,
            ratingCount: agg[0].count,
          });
        }
        results.rider = { success: true, score: riderScore };
      }
    }

    res.json({ message: "Rating submitted", results });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Already rated this order" });
    console.error("submitRating error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /ratings/order/:orderId
 * Check if customer has already rated this order
 */
exports.getOrderRatings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    const ratings = await Rating.find({ order: orderId, customer: userId });
    const vendorRating = ratings.find(r => r.targetType === "vendor");
    const riderRating = ratings.find(r => r.targetType === "rider");

    res.json({
      hasRatedVendor: !!vendorRating,
      hasRatedRider: !!riderRating,
      vendorScore: vendorRating?.score || null,
      riderScore: riderRating?.score || null,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};