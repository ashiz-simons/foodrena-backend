const express = require('express');
const router = express.Router();

const vendorController = require('../controllers/vendorController');
const vendorBankController = require('../controllers/vendorBankController');
const protectVendor = require('../middleware/protectVendor');
const auth = require("../middleware/auth");
const allow = require("../middleware/allow");

// ================= SPECIFIC ROUTES FIRST =================

// Dashboard
router.get('/dashboard', protectVendor, vendorController.getDashboard);

// Profile
router.get('/me', protectVendor, vendorController.getMyVendor);
router.put('/me', protectVendor, vendorController.updateVendor);
router.patch('/logo', auth, allow("vendor"), vendorController.updateLogo);
router.post('/onboard', protectVendor, vendorController.completeOnboarding);

// Bank
router.get('/me/bank', protectVendor, vendorBankController.getBank);
router.post('/me/bank', protectVendor, vendorBankController.addOrUpdateBank);

// Menu (authenticated)
router.get('/menu', protectVendor, vendorController.getMyMenu);
router.post('/menu', protectVendor, vendorController.addMenuItem);
router.patch('/menu/:menuItemId/image', auth, allow("vendor"), vendorController.updateMenuItemImage);
router.put('/menu/:menuItemId', auth, allow("vendor"), vendorController.updateMenuItem);
router.delete('/menu/:menuItemId', auth, allow("vendor"), vendorController.deleteMenuItem);
router.get('/popular-dishes', vendorController.getPopularDishes);
router.get('/search', vendorController.searchVendorsAndDishes);

// ================= PUBLIC (wildcard :id routes last) =================
router.get('/', vendorController.getVendors);
router.post('/', protectVendor, vendorController.createVendor);
router.get('/:id/menu', vendorController.getVendorMenuPublic);

module.exports = router;