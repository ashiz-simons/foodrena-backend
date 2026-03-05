const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require("../middleware/auth");

router.post("/switch-role", auth, authController.switchRole);
router.post("/register-admin", authController.registerAdmin);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post("/admin/login", authController.adminLogin);
router.post("/admin/verify-otp", authController.verifyAdminOtp);

module.exports = router;