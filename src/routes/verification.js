// api/src/routes/verification.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const verificationController = require('../controllers/verificationController');

// send verification to authenticated user or by email
router.post('/send', auth, verificationController.sendVerification);

// verify token
router.post('/verify', verificationController.verify);

module.exports = router;
