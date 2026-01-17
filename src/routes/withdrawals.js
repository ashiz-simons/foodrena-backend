const router = require('express').Router();
const auth = require('../middleware/auth');
const { requestWithdrawal } = require('../controllers/withdrawalController');

router.post('/', auth, requestWithdrawal);

module.exports = router;
