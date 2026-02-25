const express = require("express");
const router = express.Router();
const protectAdmin = require("../middleware/protectAdmin");
const {
  getAdminEarnings,
  getEarnings,
} = require("../controllers/adminEarningsController");

router.get("/summary", protectAdmin, getAdminEarnings);
router.get("/", protectAdmin, getEarnings);

module.exports = router;
