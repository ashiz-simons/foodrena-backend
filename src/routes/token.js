// api/src/routes/token.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { refreshToken, revokeTokens } = require('../controllers/tokenController');

// refresh access token using refresh token
router.post('/refresh', refreshToken);

// revoke refresh tokens for logged-in user
router.post('/revoke', auth, revokeTokens);

module.exports = router;
