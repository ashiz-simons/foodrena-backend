const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("../services/notifications/email");

/**
 * GET current admin profile
 */
exports.getAdminProfile = async (req, res) => {
  res.json({
    id: req.admin._id,
    name: req.admin.name,
    email: req.admin.email,
    role: req.admin.role,
    twoFactorEnabled: req.admin.twoFactorEnabled || false,
  });
};

/**
 * CHANGE ADMIN PASSWORD
 */
exports.changeAdminPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const admin = await User.findById(req.admin._id).select("+password");

  const valid = await bcrypt.compare(currentPassword, admin.password);
  if (!valid) {
    return res.status(400).json({ message: "Wrong current password" });
  }

  admin.password = newPassword;
  await admin.save();

  res.json({ message: "Password updated successfully" });
};

/**
 * REQUEST EMAIL CHANGE (SEND TOKEN)
 */
exports.requestEmailChange = async (req, res) => {
  const { newEmail } = req.body;

  const token = crypto.randomBytes(20).toString("hex");

  req.admin.emailVerificationToken = token;
  req.admin.emailVerificationExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  req.admin.pendingEmail = newEmail;

  await req.admin.save();

  await sendEmail(
    newEmail,
    "Confirm Email Change",
    `
      <p>You requested to change your admin email.</p>
      <p>Use this verification token:</p>
      <strong>${token}</strong>
    `
  );

  res.json({ message: "Verification email sent" });
};

/**
 * CONFIRM EMAIL CHANGE
 */
exports.confirmEmailChange = async (req, res) => {
  const { token } = req.body;

  const admin = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
    role: "admin",
  });

  if (!admin) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  admin.email = admin.pendingEmail;
  admin.pendingEmail = undefined;
  admin.emailVerificationToken = undefined;
  admin.emailVerificationExpires = undefined;

  await admin.save();

  res.json({ message: "Email updated successfully" });
};

exports.toggleTwoFactor = async (req, res) => {
  req.user.twoFactorEnabled = !req.user.twoFactorEnabled;
  await req.user.save();

  res.json({
    message: "Two-factor authentication updated",
    enabled: req.user.twoFactorEnabled,
  });
};
