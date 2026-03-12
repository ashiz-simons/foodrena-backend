const Promo  = require("../models/Promo");
const Order  = require("../models/Order");

// ── Admin: create promo ────────────────────────────────────────────────────
exports.adminCreate = async (req, res) => {
  try {
    const { code, type, discountPercent, minOrder, expiresAt, firstOrderOnly } = req.body;

    if (!code || !type) return res.status(400).json({ message: "code and type are required" });
    if (type === "percent" && (!discountPercent || discountPercent < 1 || discountPercent > 100)) {
      return res.status(400).json({ message: "discountPercent must be 1-100 for percent type" });
    }

    const promo = await Promo.create({
      code: code.toUpperCase().trim(),
      type,
      discountPercent: type === "percent" ? discountPercent : null,
      minOrder:        minOrder || 0,
      expiresAt:       expiresAt || null,
      firstOrderOnly:  firstOrderOnly || false,
      createdByRole:   "admin",
      vendorId:        null,
    });

    res.status(201).json({ message: "Promo created", promo });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Promo code already exists" });
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: list all promos ─────────────────────────────────────────────────
exports.adminList = async (req, res) => {
  try {
    const promos = await Promo.find().sort({ createdAt: -1 }).populate("vendorId", "businessName");
    res.json(promos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: toggle active / delete ─────────────────────────────────────────
exports.adminDelete = async (req, res) => {
  try {
    await Promo.findByIdAndDelete(req.params.id);
    res.json({ message: "Promo deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.adminToggle = async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (!promo) return res.status(404).json({ message: "Promo not found" });
    promo.isActive = !promo.isActive;
    await promo.save();
    res.json({ message: "Updated", promo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Vendor: create promo ───────────────────────────────────────────────────
exports.vendorCreate = async (req, res) => {
  try {
    const { code, type, discountPercent, minOrder, expiresAt, firstOrderOnly } = req.body;
    const vendorId = req.vendor._id;

    if (!code || !type) return res.status(400).json({ message: "code and type are required" });
    if (type === "percent" && (!discountPercent || discountPercent < 1 || discountPercent > 100)) {
      return res.status(400).json({ message: "discountPercent must be 1-100" });
    }

    const promo = await Promo.create({
      code: code.toUpperCase().trim(),
      type,
      discountPercent: type === "percent" ? discountPercent : null,
      minOrder:        minOrder || 0,
      expiresAt:       expiresAt || null,
      firstOrderOnly:  firstOrderOnly || false,
      createdByRole:   "vendor",
      vendorId,
    });

    res.status(201).json({ message: "Promo created", promo });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Promo code already exists" });
    res.status(500).json({ message: err.message });
  }
};

// ── Vendor: list own promos ────────────────────────────────────────────────
exports.vendorList = async (req, res) => {
  try {
    const promos = await Promo.find({ vendorId: req.vendor._id }).sort({ createdAt: -1 });
    res.json(promos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Vendor: delete own promo ───────────────────────────────────────────────
exports.vendorDelete = async (req, res) => {
  try {
    const promo = await Promo.findOne({ _id: req.params.id, vendorId: req.vendor._id });
    if (!promo) return res.status(404).json({ message: "Not found" });
    await promo.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Customer: apply promo code ────────────────────────────────────────────
// POST /promos/apply  { code, orderTotal, vendorId? }
exports.applyPromo = async (req, res) => {
  try {
    const { code, orderTotal, vendorId } = req.body;
    const userId = req.user._id;

    if (!code) return res.status(400).json({ message: "No code provided" });

    const promo = await Promo.findOne({ code: code.toUpperCase().trim(), isActive: true });
    if (!promo) return res.status(404).json({ message: "Invalid promo code" });

    // Expiry check
    if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
      return res.status(400).json({ message: "Promo code has expired" });
    }

    // One use per customer
    if (promo.usedBy.includes(userId)) {
      return res.status(400).json({ message: "You have already used this code" });
    }

    // Minimum order
    if (orderTotal < promo.minOrder) {
      return res.status(400).json({
        message: `Minimum order of ₦${promo.minOrder} required for this code`,
      });
    }

    // First order only
    if (promo.firstOrderOnly) {
      const pastOrder = await Order.findOne({ user: userId, status: "delivered" });
      if (pastOrder) {
        return res.status(400).json({ message: "This code is for first-time orders only" });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    let discountType   = promo.type;

    if (promo.type === "percent") {
      discountAmount = Math.round((promo.discountPercent / 100) * orderTotal);
    }
    // free_delivery: discountAmount stays 0 here —
    // the client uses type === "free_delivery" to zero out delivery fee

    res.json({
      valid:          true,
      promoId:        promo._id,
      type:           discountType,
      discountPercent: promo.discountPercent,
      discountAmount,
      message:
        promo.type === "percent"
          ? `${promo.discountPercent}% off applied!`
          : "Free delivery applied!",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Customer: public list of active promos (for banner) ───────────────────
exports.publicList = async (req, res) => {
  try {
    const promos = await Promo.find({
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .select("code type discountPercent minOrder firstOrderOnly expiresAt vendorId")
      .populate("vendorId", "businessName")
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(promos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};