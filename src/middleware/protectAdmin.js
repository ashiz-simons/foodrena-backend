const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function protectAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await User.findById(decoded.id);

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    // attach admin to request
    req.admin = admin;
    req.user = admin; // keep compatibility with earlier code

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
