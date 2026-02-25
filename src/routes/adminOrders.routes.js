const router = require("express").Router();
const {
  getAllOrders,
  cancelOrder,
  forceCompleteOrder,
} = require("../controllers/adminOrdersController");
const protectAdmin = require("../middleware/protectAdmin");

router.use(protectAdmin);

router.get("/", getAllOrders);
router.patch("/:id/cancel", cancelOrder);
router.patch("/:id/force-complete", forceCompleteOrder);

module.exports = router;
