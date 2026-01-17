const express = require("express");
const router = express.Router();
const protectAdmin = require("../middleware/protectAdmin");
const controller = require("../controllers/adminAnalytics.controller");

router.get("/dashboard", protectAdmin, controller.getDashboardStats);

module.exports = router;
