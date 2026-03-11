const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");

// POST /api/users/fcm-token
// Called by Flutter after login or when FCM token refreshes
router.post("/fcm-token", auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });

    await User.findByIdAndUpdate(req.user._id, { fcmToken: token });
    res.json({ message: "FCM token saved" });
  } catch (err) {
    console.error("FCM token save error:", err.message);
    res.status(500).json({ message: "Failed to save token" });
  }
});

module.exports = router;