const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  console.log("🧪 AUTH HEADER:", authHeader);
  console.log("🧪 JWT_SECRET (verify):", process.env.JWT_SECRET);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  console.log("🧪 TOKEN RECEIVED:", token);

  try {
    const decoded = verifyToken(token);
    console.log("🧪 TOKEN DECODED:", decoded);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    req.user = user;
    next();
  } catch (err) {
    console.error("❌ JWT VERIFY ERROR:", err.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
};