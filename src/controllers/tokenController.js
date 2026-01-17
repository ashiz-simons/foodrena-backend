// api/src/controllers/tokenController.js
const Token = require('../models/Token');
const User = require('../models/User');
const { generateTokenHex } = require('../utils/crypto');
const { signToken } = require('../utils/jwt');

const REFRESH_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

// Generate new refresh token
async function createRefreshToken(userId) {
  const token = generateTokenHex(32);
  const expiresAt = new Date(Date.now() + REFRESH_TTL);

  await Token.create({
    user: userId,
    token,
    type: 'refresh',
    expiresAt,
  });

  return token;
}

// POST /api/token/refresh
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken)
    return res.status(400).json({ message: 'refreshToken required' });

  const tokenDoc = await Token.findOne({
    token: refreshToken,
    type: 'refresh',
    used: false,
  });

  if (!tokenDoc)
    return res.status(401).json({ message: 'Invalid refresh token' });

  const user = await User.findById(tokenDoc.user);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // invalidate the old token
  tokenDoc.used = true;
  await tokenDoc.save();

  const newAccess = signToken({ id: user._id });
  const newRefresh = await createRefreshToken(user._id);

  res.json({
    accessToken: newAccess,
    refreshToken: newRefresh,
  });
};

// POST /api/token/revoke
exports.revokeTokens = async (req, res) => {
  await Token.updateMany(
    { user: req.user._id, type: 'refresh', used: false },
    { $set: { used: true } }
  );

  res.json({ message: 'All refresh tokens revoked' });
};
