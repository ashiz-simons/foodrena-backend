// api/src/utils/crypto.js
const crypto = require('crypto');

function generateTokenHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { generateTokenHex };
