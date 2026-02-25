const express = require('express');
const router = express.Router();

const vendorController = require('../controllers/vendorController');
const vendorBankController = require('../controllers/vendorBankController');
const protectVendor = require('../middleware/protectVendor');

// ================= PUBLIC =================
router.get('/', vendorController.getVendors);
router.get('/:id/menu', vendorController.getVendorMenuPublic);

// ================= DASHBOARD =================
router.get(
  '/dashboard',
  protectVendor,
  vendorController.getDashboard
);

// ================= PROFILE =================
router.post('/', protectVendor, vendorController.createVendor);
router.get('/me', protectVendor, vendorController.getMyVendor);
router.put('/me', protectVendor, vendorController.updateVendor);

// ================= BANK =================
router.get(
  '/me/bank',
  protectVendor,
  vendorBankController.getBank
);

router.post(
  '/me/bank',
  protectVendor,
  vendorBankController.addOrUpdateBank
);

// ================= MENU =================
router.get('/menu', protectVendor, vendorController.getMyMenu);
router.post('/menu', protectVendor, vendorController.addMenuItem);

module.exports = router;
