const User = require("../models/User");
const Rider = require("../models/Rider");
const Vendor = require("../models/Vendor");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { signToken } = require("../utils/jwt");
const { sendEmail } = require("../services/notifications/email");

/* =========================
   REGISTER
========================= */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, location } = req.body;

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

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const initialRole = role || "customer";

    const user = await User.create({
      name,
      email,
      password,
      role: initialRole,
      phone,
      location: { type: "Point", coordinates: [lng, lat] },
    });

    let rider = null;

    if (initialRole === "rider") {
      rider = await Rider.create({
        user: user._id,
        isAvailable: false,
        isActive: true,
        currentLocation: {
          type: "Point",
          coordinates: [lng, lat],
        },
        lastActiveAt: new Date(),
      });
    }

    if (initialRole === "vendor") {
      await Vendor.create({
        owner: user._id,
        phone: user.phone,
        location: { type: "Point", coordinates: location.coordinates },
        status: "pending",
        isOpen: false,
      });
    }

    const token = initialRole !== "admin"
      ? signToken({ id: user._id, role: user.role })
      : null;

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      rider: rider ? {
        id: rider._id,
        isAvailable: rider.isAvailable,
        isActive: rider.isActive,
        vehicleType: rider.vehicleType || null,
        currentLocation: rider.currentLocation,
      } : null,
      token,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Registration failed" });
  }
};

/* =========================
   LOGIN
========================= */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await user.matchPassword(password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = signToken({ id: user._id, role: user.role });

    let rider = null;

    if (user.role === "rider") {
      rider = await Rider.findOne({ user: user._id });

      if (!rider) {
        rider = await Rider.create({
          user: user._id,
          isAvailable: false,
          isActive: true,
          currentLocation: {
            type: "Point",
            coordinates: user.location?.coordinates || [0, 0],
          },
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
      rider: rider ? {
        id: rider._id,
        isAvailable: rider.isAvailable,
        isActive: rider.isActive,
        vehicleType: rider.vehicleType || null,
        currentLocation: rider.currentLocation,
      } : null,
      token,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
};

/* =========================
   ADMIN LOGIN (STEP 1)
========================= */
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await User.findOne({ email, role: "admin" }).select("+password");
  if (!admin) return res.status(401).json({ message: "Invalid credentials" });

  if (!admin.emailVerified) return res.status(401).json({ message: "Email not verified" });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  if (admin.twoFactorEnabled) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.otp = {
      codeHash: await bcrypt.hash(otp, 10),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    await admin.save();
    await sendEmail(admin.email, "Admin Login OTP", `<p>Your OTP is <b>${otp}</b>. Expires in 10 minutes.</p>`);
    return res.json({ requiresOtp: true, message: "OTP sent" });
  }

  const token = signToken({ id: admin._id, role: admin.role });
  res.json({ token, user: { id: admin._id, email: admin.email, role: admin.role } });
};

/* =========================
   ADMIN OTP VERIFY (STEP 2)
========================= */
exports.verifyAdminOtp = async (req, res) => {
  const { email, otp } = req.body;

  const admin = await User.findOne({ email, role: "admin" }).select("+otp");
  if (!admin || !admin.otp?.codeHash) return res.status(400).json({ message: "OTP not found" });
  if (admin.otp.expiresAt < Date.now()) return res.status(400).json({ message: "OTP expired" });

  const valid = await bcrypt.compare(otp, admin.otp.codeHash);
  if (!valid) return res.status(400).json({ message: "Invalid OTP" });

  admin.otp = undefined;
  await admin.save();

  const token = jwt.sign(
    { id: admin._id, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token, user: { id: admin._id, email: admin.email, role: admin.role } });
};

/* =========================
   REGISTER ADMIN
========================= */
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, location, adminKey, securityQuestions } = req.body;

    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: "Invalid admin key" });
    }

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
      return res.status(400).json({ message: "Invalid location format. Must be GeoJSON Point." });
    }

    const [lng, lat] = location.coordinates;
    if (typeof lng !== "number" || typeof lat !== "number") {
      return res.status(400).json({ message: "Coordinates must be numbers [lng, lat]" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    let hashedQuestions = [];
    if (securityQuestions && Array.isArray(securityQuestions)) {
      hashedQuestions = await Promise.all(
        securityQuestions.map(async (q) => ({
          question: q.question,
          answerHash: await bcrypt.hash(q.answer.toLowerCase().trim(), 10),
        }))
      );
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: "admin",
      phone,
      location: { type: "Point", coordinates: [lng, lat] },
      emailVerified: true,
      twoFactorEnabled: true,
      securityQuestions: hashedQuestions,
    });

    await sendEmail(
      admin.email,
      "Admin Account Created",
      `<p>Hi <b>${admin.name}</b>, your Foodrena admin account has been created successfully.</p>`
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