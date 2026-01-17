const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const vendorController = require('../controllers/vendorController');

// Create vendor profile
router.post('/', auth, vendorController.createVendor);

// Get my vendor profile
router.get('/me', auth, vendorController.getMyVendor);

// Update my vendor profile
router.put('/me', auth, vendorController.updateVendor);

// Get my menu
router.get('/menu', auth, vendorController.getMyMenu);

// Add menu item
router.post('/menu', auth, vendorController.addMenuItem);

module.exports = router;
