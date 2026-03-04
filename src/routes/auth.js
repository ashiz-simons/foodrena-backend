const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post("/register-admin", authController.registerAdmin);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post("/admin/login", authController.adminLogin);
router.post("/admin/verify-otp", authController.verifyAdminOtp);

module.exports = router;