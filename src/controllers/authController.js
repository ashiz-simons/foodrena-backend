const User = require("../models/User");
const Rider = require("../models/Rider");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { signToken } = require("../utils/jwt");
const { sendEmail } = require("../services/notifications/email");

/* =========================
   REGISTER
========================= */
exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const verifyToken = crypto.randomBytes(20).toString("hex");

  const user = await User.create({
    name,
    email,
    password,
    role,
    emailVerificationToken: verifyToken,
    emailVerificationExpires: Date.now() + 60 * 60 * 1000,
  });

  try {
    await sendEmail(
      user.email,
      "Verify your account",
      `<p>Hello ${user.name},</p>
       <p>Your verification token:</p>
       <strong>${verifyToken}</strong>`
    );
  } catch (err) {
    console.error("Verification email failed:", err.message);
  }

  // ❌ No token for admin
  let token = null;
  if (user.role !== "admin") {
    token = signToken({ id: user._id, role: user.role });
  }

  // ✅ AUTO-CREATE RIDER PROFILE IF REGISTERING AS RIDER
  let rider = null;
  if (user.role === "rider") {
    rider = await Rider.create({
      user: user._id,
      isAvailable: false,
      isActive: true,
      currentLocation: { lat: 0, lng: 0 },
      lastActiveAt: new Date(),
    });
  }

  res.status(201).json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    rider,
    token,
  });
};


/* =========================
   USER / VENDOR / RIDER LOGIN
========================= */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const match = await user.matchPassword(password);
  if (!match) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = signToken({ id: user._id, role: user.role });
  
  console.log("🧪 JWT_SECRET (sign):", process.env.JWT_SECRET);
  console.log("🧪 TOKEN ISSUED:", token);
  // ================= RIDER AUTO-SYNC =================
  let rider = null;

  if (user.role === "rider") {
    rider = await Rider.findOne({ user: user._id });

    // AUTO-CREATE IF MISSING (CRITICAL FIX)
    if (!rider) {
      rider = await Rider.create({
        user: user._id,
        isAvailable: false,
        isActive: true,
        currentLocation: { lat: 0, lng: 0 },
        lastActiveAt: new Date(),
      });

      console.log("🆕 Auto-created rider profile:", rider._id);
    }
  }

  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },

    // Return rider profile if exists
    rider: rider
      ? {
          id: rider._id,
          isAvailable: rider.isAvailable,
          isActive: rider.isActive,
          vehicleType: rider.vehicleType || null,
          currentLocation: rider.currentLocation,
        }
      : null,

    token,
  });
};


/* =========================
   ADMIN LOGIN (STEP 1)
========================= */
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await User.findOne({ email, role: "admin" }).select("+password");
  if (!admin) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!admin.emailVerified) {
    return res.status(401).json({ message: "Email not verified" });
  }

  const match = await bcrypt.compare(password, admin.password);
  if (!match) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // 🔐 OTP REQUIRED
  if (admin.twoFactorEnabled) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    admin.otp = {
      codeHash: await bcrypt.hash(otp, 10),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    await admin.save();

    await sendEmail(
      admin.email,
      "Admin Login OTP",
      `<p>Your OTP is <b>${otp}</b>. Expires in 10 minutes.</p>`
    );

    return res.json({
      requiresOtp: true,
      message: "OTP sent",
    });
  }

  // Fallback if OTP disabled
  const token = signToken({ id: admin._id, role: admin.role });

  res.json({
    token,
    user: {
      id: admin._id,
      email: admin.email,
      role: admin.role,
    },
  });
};


/* =========================
   ADMIN OTP VERIFY (STEP 2)
========================= */
exports.verifyAdminOtp = async (req, res) => {
  const { email, otp } = req.body;

  const admin = await User.findOne({ email, role: "admin" }).select("+otp");

  if (!admin || !admin.otp?.codeHash) {
    return res.status(400).json({ message: "OTP not found" });
  }

  if (admin.otp.expiresAt < Date.now()) {
    return res.status(400).json({ message: "OTP expired" });
  }

  const valid = await bcrypt.compare(otp, admin.otp.codeHash);
  if (!valid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  admin.otp = undefined;
  await admin.save();

  const token = jwt.sign(
    { id: admin._id, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    token,
    user: {
      id: admin._id,
      email: admin.email,
      role: admin.role,
    },
  });
};
