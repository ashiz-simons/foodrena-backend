const express = require("express");
const router = express.Router();

const protectAdmin = require("../middleware/protectAdmin");
const controller = require("../controllers/adminSettingsController");

router.get("/profile", protectAdmin, controller.getAdminProfile);
router.patch("/change-password", protectAdmin, controller.changeAdminPassword);
router.post("/change-email", protectAdmin, controller.requestEmailChange);
router.post("/confirm-email", protectAdmin, controller.confirmEmailChange);

module.exports = router;
