const User = require("../models/User");
const Rider = require("../models/Rider");
const Vendor = require("../models/Vendor");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { signToken } = require("../utils/jwt");
const { sendEmail } = require("../services/notifications/email");
const admin = require("../config/firebase"); // Firebase Admin SDK

/* =========================
   VERIFY FIREBASE PHONE OTP
   Flutter sends the Firebase ID token after phone verification
   Backend verifies it and marks phone as verified
========================= */
exports.verifyPhoneOtp = async (req, res) => {
  try {
    const { idToken, phone } = req.body;

    if (!idToken || !phone) {
      return res.status(400).json({ message: "idToken and phone required" });
    }

    // Verify the Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Firebase stores phone as decoded.phone_number
    const firebasePhone = decoded.phone_number;

    if (!firebasePhone) {
      return res.status(400).json({ message: "Phone not found in token" });
    }

    // Normalize both numbers for comparison
    const normalize = (p) => p.replace(/\s+/g, "").replace(/^\+/, "");
    if (normalize(firebasePhone) !== normalize(phone)) {
      return res.status(400).json({ message: "Phone number mismatch" });
    }

    res.json({ verified: true, phone: firebasePhone });
  } catch (err) {
    console.error("VERIFY PHONE OTP ERROR:", err);
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

/* =========================
   REGISTER
========================= */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, location, idToken } = req.body;

    if (!name || !password || !phone) {
      return res.status(400).json({
        message: "Name, password and phone are required",
      });
    }

    // 🔧 PHONE_VERIFY_ENABLED=false: accept "bypass" token until Firebase billing enabled
    const PHONE_VERIFY_ENABLED = process.env.PHONE_VERIFY_ENABLED === "true";

    if (!idToken) {
      return res.status(400).json({ message: "Phone verification required" });
    }

    if (PHONE_VERIFY_ENABLED && idToken !== "bypass") {
      let firebasePhone;
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        firebasePhone = decoded.phone_number;
        const normalize = (p) => p.replace(/\s+/g, "").replace(/^\+/, "");
        if (!firebasePhone || normalize(firebasePhone) !== normalize(phone)) {
          return res.status(400).json({ message: "Phone verification failed" });
        }
      } catch {
        return res.status(400).json({ message: "Invalid phone verification token" });
      }
    }

    // Check phone uniqueness
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ message: "Phone number already registered" });
    }

    // Check email uniqueness if provided
    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: "Email already registered" });
      }
    }

    // Handle location — optional, default to [0,0]
    let coords = [0, 0];
    if (location?.coordinates?.length === 2) {
      const [lng, lat] = location.coordinates;
      if (typeof lng === "number" && typeof lat === "number") {
        coords = [lng, lat];
      }
    }

    const initialRole = role || "customer";

    const user = await User.create({
      name,
      email: email || undefined,
      password,
      role: initialRole,
      phone,
      phoneVerified: false,
      location: { type: "Point", coordinates: coords },
    });

    let rider = null;

    if (initialRole === "rider") {
      rider = await Rider.create({
        user: user._id,
        isAvailable: false,
        isActive: true,
        currentLocation: { type: "Point", coordinates: coords },
        lastActiveAt: new Date(),
      });
    }

    if (initialRole === "vendor") {
      await Vendor.create({
        owner: user._id,
        phone: user.phone,
        location: { type: "Point", coordinates: coords },
        status: "pending",
        isOpen: false,
      });
    }

    const token = signToken({ id: user._id, role: user.role });

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        phoneVerified: true,
      },
      rider: rider ? {
        _id: rider._id,
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
   LOGIN — phone or email
========================= */
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Phone or email required" });
    }

    // Find user by phone or email
    const query = phone ? { phone } : { email: email.toLowerCase() };
    const user = await User.findOne(query).select("+password");

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
      }
    }

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
      },
      rider: rider ? {
        _id: rider._id,
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

  const admin2 = await User.findOne({ email, role: "admin" }).select("+password");
  if (!admin2) return res.status(401).json({ message: "Invalid credentials" });

  if (!admin2.emailVerified) return res.status(401).json({ message: "Email not verified" });

  const match = await bcrypt.compare(password, admin2.password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  if (admin2.twoFactorEnabled) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin2.otp = {
      codeHash: await bcrypt.hash(otp, 10),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    await admin2.save();
    await sendEmail(admin2.email, "Admin Login OTP", `<p>Your OTP is <b>${otp}</b>. Expires in 10 minutes.</p>`);
    return res.json({ requiresOtp: true, message: "OTP sent" });
  }

  const token = signToken({ id: admin2._id, role: admin2.role });
  res.json({ token, user: { id: admin2._id, email: admin2.email, role: admin2.role } });
};

/* =========================
   ADMIN OTP VERIFY (STEP 2)
========================= */
exports.verifyAdminOtp = async (req, res) => {
  const { email, otp } = req.body;

  const adminUser = await User.findOne({ email, role: "admin" }).select("+otp");
  if (!adminUser || !adminUser.otp?.codeHash) return res.status(400).json({ message: "OTP not found" });
  if (adminUser.otp.expiresAt < Date.now()) return res.status(400).json({ message: "OTP expired" });

  const valid = await bcrypt.compare(otp, adminUser.otp.codeHash);
  if (!valid) return res.status(400).json({ message: "Invalid OTP" });

  adminUser.otp = undefined;
  await adminUser.save();

  const token = jwt.sign(
    { id: adminUser._id, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token, user: { id: adminUser._id, email: adminUser.email, role: adminUser.role } });
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

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "Name, email, password and phone are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    let coords = [0, 0];
    if (location?.coordinates?.length === 2) coords = location.coordinates;

    let hashedQuestions = [];
    if (securityQuestions && Array.isArray(securityQuestions)) {
      hashedQuestions = await Promise.all(
        securityQuestions.map(async (q) => ({
          question: q.question,
          answerHash: await bcrypt.hash(q.answer.toLowerCase().trim(), 10),
        }))
      );
    }

    const adminUser = await User.create({
      name, email, password, role: "admin", phone,
      location: { type: "Point", coordinates: coords },
      emailVerified: true,
      twoFactorEnabled: true,
      securityQuestions: hashedQuestions,
    });

    await sendEmail(adminUser.email, "Admin Account Created",
      `<p>Hi <b>${adminUser.name}</b>, your Foodrena admin account has been created.</p>`);

    res.status(201).json({
      message: "Admin account created successfully",
      user: { id: adminUser._id, name: adminUser.name, email: adminUser.email, role: adminUser.role },
    });
  } catch (error) {
    console.error("REGISTER ADMIN ERROR:", error);
    res.status(500).json({ message: "Admin registration failed" });
  }
};

/* =========================
   SWITCH ROLE
========================= */
exports.switchRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.user._id;

    const validRoles = ["customer", "rider", "vendor"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (role === "rider") {
      const rider = await Rider.findOne({ user: userId });
      if (!rider || !rider.vehicleType || !rider.vehiclePlate) {
        return res.status(400).json({ message: "Vehicle info required", requiresVehicleInfo: true });
      }
    }

    if (role === "vendor") {
      const vendor = await Vendor.findOne({ owner: userId });
      if (!vendor) {
        await Vendor.create({
          owner: userId, phone: user.phone,
          location: user.location, status: "pending", isOpen: false,
        });
      }
    }

    if (!Array.isArray(user.roles)) user.roles = [user.role];
    if (!user.roles.includes(role)) user.roles.push(role);

    user.activeRole = role;
    user.role = role;
    await user.save();

    const token = signToken({ id: user._id, role });

    res.json({
      message: `Switched to ${role}`,
      token,
      user: { id: user._id, name: user.name, email: user.email, role, activeRole: role, roles: user.roles },
    });
  } catch (err) {
    console.error("SWITCH ROLE ERROR:", err);
    res.status(500).json({ message: "Role switch failed" });
  }
};