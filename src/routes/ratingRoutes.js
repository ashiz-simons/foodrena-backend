const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");

let ratingController;
try {
  ratingController = require("../controllers/ratingController");
  console.log("✅ ratingController loaded:", Object.keys(ratingController));
} catch (err) {
  console.error("❌ ratingController load failed:", err.message);
  console.error(err.stack);
  ratingController = {
    submitRating: (req, res) => res.status(503).json({ message: "Rating service unavailable" }),
    getOrderRatings: (req, res) => res.status(503).json({ message: "Rating service unavailable" }),
  };
}

router.post("/", protect, ratingController.submitRating);
router.get("/order/:orderId", protect, ratingController.getOrderRatings);
module.exports = router;