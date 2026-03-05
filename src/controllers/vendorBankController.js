const Vendor = require("../models/Vendor");

// GET my bank
exports.getBank = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id }).select("bank");

  if (!vendor || !vendor.bank) {
    return res.json(null);
  }

  res.json(vendor.bank);
};

// ADD / UPDATE bank
exports.addOrUpdateBank = async (req, res) => {
  const { bankName, accountNumber, accountName } = req.body;

  const vendor = await Vendor.findOne({ owner: req.user._id });

  if (!vendor) {
    return res.status(404).json({ message: "Vendor not found" });
  }

  vendor.bank = {
    bankName,
    accountNumber,
    accountName,
  };

  await vendor.save();

  res.json(vendor.bank);
};

