const express = require('express');
const router = express.Router();

const protectUser = require('../middleware/protectUser');
const userController = require('../controllers/userController');

// ================= PROFILE =================
router.get('/me', protectUser, userController.getMe);

// ================= LOCATION =================
router.post('/location', protectUser, userController.saveLocation);

// ================= LOGOUT =================
router.post('/logout', protectUser, userController.logout);

module.exports = router;