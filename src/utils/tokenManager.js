const Token = require('../models/Token');
const { generateTokenHex } = require('./crypto');

const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

async function issueRefreshToken(userId) {
  const tokenStr = generateTokenHex(32);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await Token.create({ user: userId, token: tokenStr, type: 'refresh', expiresAt });
  return tokenStr;
}

module.exports = { issueRefreshToken };
