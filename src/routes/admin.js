const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roles');
const adminController = require('../controllers/adminController');

// ===============================
// ORDERS
// ===============================
router.get('/orders', auth, allow('admin'), adminController.getAllOrders);

// ===============================
// WITHDRAWALS
// ===============================
router.get('/withdrawals', auth, allow('admin'), adminController.getAllWithdrawals);

// ===============================
// REVENUE
// ===============================
router.get('/revenue', auth, allow('admin'), adminController.getPlatformRevenue);

// ===============================
// VENDORS
// ===============================
router.get('/vendors', auth, allow('admin'), adminController.getAllVendors);
router.patch('/vendors/:id/verify', auth, allow('admin'), adminController.verifyVendor);
router.patch('/vendors/:id/suspend', auth, allow('admin'), adminController.suspendVendor);
router.patch('/vendors/:id/reinstate', auth, allow('admin'), adminController.reinstateVendor);

// ===============================
// RIDERS  ← NEW
// ===============================
router.get('/riders', auth, allow('admin'), adminController.getAllRiders);
router.patch('/riders/:id/suspend', auth, allow('admin'), adminController.suspendRider);
router.patch('/riders/:id/activate', auth, allow('admin'), adminController.activateRider);

module.exports = router;