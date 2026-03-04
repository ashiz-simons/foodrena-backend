const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roles');
const orderController = require('../controllers/orderController');

// =======================
// USER
// =======================

// create order
router.post(
  '/',
  auth,
  allow('customer'),
  orderController.createOrder
);

// get my orders
router.get(
  '/my',
  auth,
  allow('customer'),
  orderController.getMyOrders
);

// =======================
// VENDOR
// =======================

// get vendor orders
router.get(
  '/vendor',
  auth,
  allow('vendor'),
  orderController.getVendorOrders
);

// update order status
router.patch(
  '/:id/status',
  auth,
  allow('vendor'),
  orderController.updateOrderStatus
);

module.exports = router;
