const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminAuthController");

router.post("/forgot-password", controller.requestPasswordReset);
router.post("/verify-reset", controller.verifyResetSecurity);
router.post("/reset-password", controller.resetPassword);

module.exports = router;
