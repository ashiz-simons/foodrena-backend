const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Rider = require("../models/Rider");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user early
    req.user = user;

    // Ensure role
    if (user.role !== "rider") {
      return res.status(403).json({ message: "Access denied: Not a rider" });
    }

    // Find rider profile correctly
    let rider = await Rider.findOne({ user: user._id });

    // Auto-create if missing
    if (!rider) {
      return res.status(403).json({ message: "Rider profile not approved yet" });
    }


    // Attach rider
    req.rider = rider;

    next();

  } catch (err) {
    console.error("❌ ProtectRider error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
