const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("../services/notifications/email");

/**
 * 1️⃣ Request password reset (send OTP)
 */
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  const admin = await User.findOne({ email, role: "admin" });
  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  admin.otp = {
    codeHash: await bcrypt.hash(otp, 10),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 mins
  };

  await admin.save();

  await sendEmail(
    admin.email,
    "Admin Password Reset OTP",
    `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`
  );

  res.json({
    message: "OTP sent",
    questions: admin.securityQuestions.map(q => q.question),
  });
};

/**
 * 2️⃣ Verify OTP + security questions
 */
exports.verifyResetSecurity = async (req, res) => {
  const { email, otp, answers } = req.body;

  const admin = await User.findOne({ email }).select("+otp");
  if (!admin || !admin.otp) {
    return res.status(400).json({ message: "Invalid request" });
  }

  if (admin.otp.expiresAt < Date.now()) {
    return res.status(400).json({ message: "OTP expired" });
  }

  const otpValid = await bcrypt.compare(otp, admin.otp.codeHash);
  if (!otpValid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  if (
    !admin.securityQuestions.length ||
    answers.length !== admin.securityQuestions.length
  ) {
    return res.status(400).json({ message: "Security answers required" });
  }

  for (let i = 0; i < admin.securityQuestions.length; i++) {
    const valid = await bcrypt.compare(
      answers[i],
      admin.securityQuestions[i].answerHash
    );
    if (!valid) {
      return res.status(401).json({ message: "Security answer mismatch" });
    }
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  admin.resetToken = resetToken;
  admin.resetTokenExpires = Date.now() + 15 * 60 * 1000;
  admin.otp = undefined;

  await admin.save();

  res.json({ resetToken });
};

/**
 * 3️⃣ Reset password
 */
exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  const admin = await User.findOne({
    resetToken,
    resetTokenExpires: { $gt: Date.now() },
  });

  if (!admin) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  admin.password = newPassword;
  admin.resetToken = undefined;
  admin.resetTokenExpires = undefined;

  await admin.save();

  res.json({ message: "Password reset successful" });
};
