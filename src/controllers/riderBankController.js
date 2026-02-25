const Rider = require("../models/Rider");

/**
 * GET /api/riders/me/bank
 */
exports.getMyBank = async (req, res) => {
  try {
    const rider = req.rider;

    if (!rider) {
      return res.status(404).json({ message: "Rider profile not found" });
    }

    res.json(rider.bank || null);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bank details" });
  }
};

/**
 * POST /api/riders/me/bank
 */
exports.saveMyBank = async (req, res) => {
  try {
    const { accountName, accountNumber, bankName } = req.body;

    if (!accountName || !accountNumber || !bankName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const rider = req.rider;

    rider.bank = {
      accountName,
      accountNumber,
      bankName,
    };

    await rider.save();

    res.json({
      message: "Bank details saved successfully",
      bank: rider.bank,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to save bank details" });
  }
};
