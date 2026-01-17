const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.get('/', auth, walletController.getMyWallet);
router.post('/withdraw', auth, walletController.requestWithdrawal);

module.exports = router;
