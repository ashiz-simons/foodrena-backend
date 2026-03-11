const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  requestWithdrawal,
  getWithdrawals,
} = require('../controllers/walletController');

// POST /api/withdrawals — request a withdrawal
router.post('/', auth, requestWithdrawal);

// GET /api/withdrawals — vendor withdrawal history
router.get('/', auth, getWithdrawals);

module.exports = router;