const express = require('express');
const router = express.Router();

const vendorController = require('../controllers/vendorController');
const vendorBankController = require('../controllers/vendorBankController');
const protectVendor = require('../middleware/protectVendor');
const auth = require("../middleware/auth");
const allow = require("../middleware/allow");

// ================= PUBLIC =================
router.get('/', vendorController.getVendors);
router.get('/:id/menu', vendorController.getVendorMenuPublic);
router.patch(
  "/menu/:menuItemId/image",
  auth,
  allow("vendor"),
  vendorController.updateMenuItemImage
);

router.put(
  "/menu/:menuItemId",
  auth,
  allow("vendor"),
  vendorController.updateMenuItem
);

router.delete(
  "/menu/:menuItemId",
  auth,
  allow("vendor"),
  vendorController.deleteMenuItem
);

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
router.patch(
  "/logo",
  auth,
  allow("vendor"),
  vendorController.updateLogo
);
router.post("/onboard", protectVendor, vendorController.completeOnboarding);

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
