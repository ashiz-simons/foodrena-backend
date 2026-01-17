const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roles');
const adminController = require('../controllers/adminController');

router.get('/orders', auth, allow('admin'), adminController.getAllOrders);
router.get('/withdrawals', auth, allow('admin'), adminController.getAllWithdrawals);
router.get('/revenue', auth, allow('admin'), adminController.getPlatformRevenue);

// 🔴 THIS IS WHAT YOU ARE MISSING
router.get('/vendors', auth, allow('admin'), adminController.getAllVendors);
router.patch('/vendors/:id/verify', auth, allow('admin'), adminController.verifyVendor);
router.patch('/vendors/:id/suspend', auth, allow('admin'), adminController.suspendVendor);

module.exports = router;
