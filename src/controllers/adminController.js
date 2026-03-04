const Order = require("../models/Order");
const Earning = require("../models/Earning");
const Wallet = require("../models/Wallet");
const Vendor = require("../models/Vendor");
const Withdrawal = require("../models/Withdrawal");

/**
 * ===============================
 * ORDERS
 * ===============================
 */

/**
 * GET all orders (admin)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("vendor", "businessName")
      .sort("-createdAt");

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

/**
 * ===============================
 * WITHDRAWALS
 * ===============================
 */

exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate("vendor", "businessName email")
      .sort("-createdAt");

    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
};

/**
 * ===============================
 * PLATFORM REVENUE
 * ===============================
 */

exports.getPlatformRevenue = async (req, res) => {
  try {
    const earnings = await Earning.find({});

    const totalPlatformProfit = earnings.reduce(
      (acc, item) => acc + (item.platformProfit || 0),
      0
    );

    const totalGross = earnings.reduce(
      (acc, item) => acc + (item.grossAmount || 0),
      0
    );

    res.json({
      totalPlatformProfit,
      totalGross,
      totalOrders: earnings.length
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to calculate revenue" });
  }
};

/**
 * ===============================
 * VENDORS
 * ===============================
 */

exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort("-createdAt");
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch vendors" });
  }
};

exports.verifyVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.status = "verified";
    vendor.isOpen = true; // optional if you want them active immediately

    await vendor.save();

    res.json({
      message: "Vendor verified successfully",
      vendor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify vendor" });
  }
};


exports.suspendVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.isSuspended = true;
    await vendor.save();

    res.json({ message: "Vendor suspended" });
  } catch (err) {
    res.status(500).json({ message: "Failed to suspend vendor" });
  }
};

exports.reinstateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.isSuspended = false;
    await vendor.save();

    res.json({ message: "Vendor reinstated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to reinstate vendor" });
  }
};

/* =========================
   REGISTER ADMIN
========================= */
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, location, adminKey, securityQuestions } = req.body;

    // 1. Validate secret key
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: "Invalid admin key" });
    }

    // 2. Validate required fields
    if (!name || !email || !password || !phone || !location) {
      return res.status(400).json({
        message: "Name, email, password, phone and location are required",
      });
    }

    if (
      !location.type ||
      location.type !== "Point" ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        message: "Invalid location format. Must be GeoJSON Point.",
      });
    }

    const [lng, lat] = location.coordinates;
    if (typeof lng !== "number" || typeof lat !== "number") {
      return res.status(400).json({ message: "Coordinates must be numbers [lng, lat]" });
    }

    // 3. Check for duplicate email
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // 4. Hash security question answers if provided
    let hashedQuestions = [];
    if (securityQuestions && Array.isArray(securityQuestions)) {
      hashedQuestions = await Promise.all(
        securityQuestions.map(async (q) => ({
          question: q.question,
          answerHash: await bcrypt.hash(q.answer.toLowerCase().trim(), 10),
        }))
      );
    }

    // 5. Create admin user
    const admin = await User.create({
      name,
      email,
      password,
      role: "admin",
      phone,
      location: { type: "Point", coordinates: [lng, lat] },
      emailVerified: true,        // admin is verified by default
      twoFactorEnabled: true,     // 2FA on by default for security
      securityQuestions: hashedQuestions,
    });

    // 6. Send welcome email
    await sendEmail(
      admin.email,
      "Admin Account Created",
      `<p>Hi <b>${admin.name}</b>, your Foodrena admin account has been created successfully.</p>
       <p>You can now log in at the admin dashboard.</p>`
    );

    res.status(201).json({
      message: "Admin account created successfully",
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("REGISTER ADMIN ERROR:", error);
    res.status(500).json({ message: "Admin registration failed" });
  }
};