const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Vendor = require('../models/Vendor');
const Withdrawal = require('../models/Withdrawal');

// GET vendor withdrawal history
router.get('/withdrawals', auth, async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) {
    return res.status(403).json({ message: 'Not a vendor' });
  }

  const withdrawals = await Withdrawal.find({ vendor: vendor._id })
    .sort({ createdAt: -1 })
    .limit(20);

  res.json(withdrawals);
});

module.exports = router;
