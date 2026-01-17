const express = require("express");
const router = express.Router();

const protectAdmin = require("../middleware/protectAdmin");
const controller = require("../controllers/adminEarningsController");

router.get("/", protectAdmin, controller.getAdminEarnings);

module.exports = router;
