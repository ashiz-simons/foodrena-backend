// api/src/controllers/verificationController.js
const Token = require('../models/Token');
const User = require('../models/User');
const { generateTokenHex } = require('../utils/crypto');
const { sendEmail } = require('../services/notifications/email');
const ms = require('ms'); // optional but handy (if not installed, TTL in ms can be used directly)

const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

exports.sendVerification = async (req, res) => {
  // Expects authenticated user (or email param). We'll support both.
  const email = (req.user && req.user.email) || req.body.email;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.isVerified) return res.status(400).json({ message: 'Already verified' });

  const tokenStr = generateTokenHex(20);
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

  // Save token
  await Token.create({ user: user._id, token: tokenStr, type: 'verification', expiresAt });

  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${tokenStr}`;

  await sendEmail(user.email, 'Verify your email', `<p>Hello ${user.name}, click <a href="${verifyUrl}">here</a> to verify your email. The link expires in 24 hours.</p>`);

  res.json({ message: 'Verification email sent' });
};

exports.verify = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Token required' });

  const tokenDoc = await Token.findOne({ token, type: 'verification', used: false });
  if (!tokenDoc) return res.status(400).json({ message: 'Invalid or expired token' });

  // mark token used and mark user verified
  tokenDoc.used = true;
  await tokenDoc.save();

  const user = await User.findById(tokenDoc.user);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.isVerified = true;
  await user.save();

  res.json({ message: 'Email verified' });
};
