const router = require("express").Router();
const protectAdmin = require("../middleware/protectAdmin");
const {
  getAllWithdrawals,
  markAsPaid,
  markAsFailed,
} = require("../controllers/adminWithdrawalsController");

router.use(protectAdmin);

router.get("/", getAllWithdrawals);
router.patch("/:id/pay", markAsPaid);
router.patch("/:id/fail", markAsFailed);

module.exports = router;
