const express = require("express");
const router = express.Router();
const protectAdmin = require("../middleware/protectAdmin");
const controller = require("../controllers/adminOrders.controller");

router.get("/", protectAdmin, controller.getAllOrders);
router.patch("/:id/cancel", protectAdmin, controller.cancelOrder);
router.patch("/:id/force-complete", protectAdmin, controller.forceCompleteOrder);

module.exports = router;
