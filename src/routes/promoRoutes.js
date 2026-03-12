const router = require("express").Router();
const auth          = require("../middleware/auth");
const protectAdmin  = require("../middleware/protectAdmin");
const protectVendor = require("../middleware/protectVendor");
const {
  publicList,
  applyPromo,
  vendorCreate,
  vendorList,
  vendorDelete,
  adminCreate,
  adminList,
  adminDelete,
  adminToggle,
} = require("../controllers/promoController");

// ── Public (no auth — home screen banner) ─────────────────────────────────
router.get("/public", publicList);

// ── Customer: apply a code ────────────────────────────────────────────────
router.post("/apply", auth, applyPromo);

// ── Vendor ────────────────────────────────────────────────────────────────
router.post("/vendor",       protectVendor, vendorCreate);
router.get("/vendor",        protectVendor, vendorList);
router.delete("/vendor/:id", protectVendor, vendorDelete);

// ── Admin ─────────────────────────────────────────────────────────────────
router.post("/admin",             protectAdmin, adminCreate);
router.get("/admin",              protectAdmin, adminList);
router.delete("/admin/:id",       protectAdmin, adminDelete);
router.patch("/admin/:id/toggle", protectAdmin, adminToggle);

module.exports = router;