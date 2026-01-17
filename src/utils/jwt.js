const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config');

function signToken(payload, options = {}) {
  return jwt.sign(payload, jwtSecret, { expiresIn: options.expiresIn || jwtExpiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { signToken, verifyToken };
