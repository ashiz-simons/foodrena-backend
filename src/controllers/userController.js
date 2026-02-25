const User = require('../models/User');

/**
 * =======================
 * GET MY PROFILE
 * =======================
 */
exports.getMe = async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  });
};

/**
 * =======================
 * SAVE USER LOCATION
 * =======================
 */
exports.saveLocation = async (req, res) => {
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'lat and lng required' });
  }

  req.user.location = {
    type: 'Point',
    coordinates: [lng, lat], // MongoDB order
  };

  await req.user.save();

  res.json({ message: 'Location saved' });
};

/**
 * =======================
 * LOGOUT
 * =======================
 * Stateless – frontend clears token
 */
exports.logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};