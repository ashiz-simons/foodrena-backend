const express  = require("express");
const router   = express.Router();
const ctrl     = require("../controllers/promoController");
const { protect }        = require("../middleware/auth");
const { protectAdmin }   = require("../middleware/protectAdmin");
const { protectVendor }  = require("../middleware/protectVendor");

// ── Public (customer, no auth needed for banner) ───────────────────────────
router.get("/public", ctrl.publicList);

// ── Customer: apply a code (auth required) ─────────────────────────────────
router.post("/apply", protect, ctrl.applyPromo);

// ── Vendor ─────────────────────────────────────────────────────────────────
router.post("/vendor",        protectVendor, ctrl.vendorCreate);
router.get("/vendor",         protectVendor, ctrl.vendorList);
router.delete("/vendor/:id",  protectVendor, ctrl.vendorDelete);

// ── Admin ──────────────────────────────────────────────────────────────────
router.post("/admin",         protectAdmin, ctrl.adminCreate);
router.get("/admin",          protectAdmin, ctrl.adminList);
router.delete("/admin/:id",   protectAdmin, ctrl.adminDelete);
router.patch("/admin/:id/toggle", protectAdmin, ctrl.adminToggle);

module.exports = router;