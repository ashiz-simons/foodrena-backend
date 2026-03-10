const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const ratingController = require("../controllers/ratingController");

router.post("/", protect, ratingController.submitRating);
router.get("/order/:orderId", protect, ratingController.getOrderRatings);

module.exports = router;