const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerAdmin } = require("../controllers/authController");

// No auth middleware — protected by adminKey in the request body instead
router.post("/register-admin", registerAdmin);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post("/admin/login", authController.adminLogin);
router.post("/admin/verify-otp", authController.verifyAdminOtp);


module.exports = router;
