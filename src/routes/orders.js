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

// cancel order (pending only)
router.patch(
  '/:id/cancel',
  auth,
  allow('customer'),
  orderController.cancelOrder
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

// get single order
router.get(
  '/:id',
  auth,
  orderController.getOrderById
);

module.exports = router;