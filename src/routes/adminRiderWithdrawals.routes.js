const router = require("express").Router();
const protectAdmin = require("../middleware/protectAdmin");

const {
  getWithdrawals,
  markPaid,
  markFailed
} = require("../controllers/adminRiderWithdrawalsController");

router.use(protectAdmin);

router.get("/", getWithdrawals);
router.patch("/:id/pay", markPaid);
router.patch("/:id/fail", markFailed);

module.exports = router;
