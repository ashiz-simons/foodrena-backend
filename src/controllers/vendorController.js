const Vendor = require('../models/Vendor');
const User = require('../models/User')
const Order = require('../models/Order');
/**
 * =======================
 * CREATE VENDOR
 * =======================
 */
exports.createVendor = async (req, res) => {
  // prevent duplicate vendor
  const exists = await Vendor.findOne({ owner: req.user._id });
  if (exists) {
    return res.status(400).json({ message: 'Vendor already exists' });
  }

  const vendor = await Vendor.create({
    owner: req.user._id,
    businessName: req.body.businessName,
    phone: req.body.phone,
    address: req.body.address,
  });

  // 🔥 UPGRADE USER ROLE
  await User.findByIdAndUpdate(req.user._id, {
    role: 'vendor',
  });

  res.status(201).json({
    message: 'Vendor created successfully',
    vendor,
  });
};

/**
 * =======================
 * GET MY VENDOR
 * =======================
 */
exports.getMyVendor = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });

  if (!vendor) {
    return res.status(404).json({ message: 'Vendor not found' });
  }

  res.json(vendor);
};

/**
 * =======================
 * UPDATE VENDOR
 * =======================
 */
exports.updateVendor = async (req, res) => {
  const vendor = await Vendor.findOneAndUpdate(
    { owner: req.user._id },
    req.body,
    { new: true }
  );

  if (!vendor) {
    return res.status(404).json({ message: 'Vendor not found' });
  }

  res.json(vendor);
};

/**
 * =======================
 * GET MY MENU
 * =======================
 */
exports.getMyMenu = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });

  if (!vendor) {
    return res.status(404).json({ message: 'Vendor not found' });
  }

  res.json({ menuItems: vendor.menuItems });
};

/**
 * =======================
 * ADD MENU ITEM
 * =======================
 */
exports.addMenuItem = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });

  if (!vendor) {
    return res.status(404).json({ message: 'Vendor not found' });
  }

  const { name, description, price } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: 'Name and price required' });
  }

  vendor.menuItems.push({
    name,
    description,
    price,
  });

  await vendor.save();

  res.status(201).json({
    message: 'Menu item added',
    menuItems: vendor.menuItems,
  });
};

exports.getDashboard = async (req, res) => {
  const vendorId = req.vendor._id;

  const orders = await Order.find({ vendor: vendorId });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.totalAmount || 0),
    0
  );

  res.json({
    totalOrders,
    totalRevenue,
    isOpen: req.vendor.isOpen,
  });
};

/**
 * =======================
 * GET ALL VENDORS (PUBLIC)
 * =======================
 */
exports.getVendors = async (req, res) => {
  const vendors = await Vendor.find(
    { isOpen: true },
    {
      businessName: 1,
      isOpen: 1,
    }
  );

  res.json(vendors);
};

/**
 * =======================
 * GET VENDOR MENU (PUBLIC)
 * =======================
 */
exports.getVendorMenuPublic = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id, {
    menuItems: 1,
    businessName: 1,
    isOpen: 1,
  });

  if (!vendor) {
    return res.status(404).json({ message: 'Vendor not found' });
  }

  // Optional: only return available items
  const menuItems = vendor.menuItems.filter(i => i.available);

  res.json(menuItems);
};