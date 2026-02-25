const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

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

    if (user.role !== "vendor") {
      return res.status(403).json({ message: "Access denied: Not a vendor" });
    }

    // ✅ FIX: owner, not user
    const vendor = await Vendor.findOne({ owner: user._id });

    if (!vendor) {
      return res
        .status(403)
        .json({ message: "Vendor profile not found" });
    }

    req.user = user;
    req.vendor = vendor;

    next();
  } catch (err) {
    console.error("❌ ProtectVendor error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
