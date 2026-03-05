const Vendor = require('../models/Vendor');
const User = require('../models/User')
const Order = require('../models/Order');
const cloudinary = require("../config/cloudinary");

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
      logo: 1,
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

exports.updateLogo = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const { imageUrl, publicId } = req.body;

    if (!imageUrl || !publicId) {
      return res.status(400).json({ message: "Image data required" });
    }

    // delete old logo
    if (vendor.logo?.publicId) {
      await cloudinary.uploader.destroy(vendor.logo.publicId);
    }

    vendor.logo = {
      url: imageUrl,
      publicId: publicId,
    };

    await vendor.save();

    res.json({
      message: "Logo updated",
      logo: vendor.logo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateMenuItemImage = async (req, res) => {
  try {
    const { menuItemId } = req.params;
    const { imageUrl, publicId } = req.body;

    if (!imageUrl || !publicId) {
      return res.status(400).json({ message: "Image data required" });
    }

    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const menuItem = vendor.menuItems.id(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Delete old image if exists
    if (menuItem.image?.publicId) {
      await cloudinary.uploader.destroy(menuItem.image.publicId);
    }

    // Assign new image
    menuItem.image = {
      url: imageUrl,
      publicId: publicId,
    };

    await vendor.save();

    res.json({
      message: "Menu item image updated",
      image: menuItem.image,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { menuItemId } = req.params;
    const { name, description, price, available } = req.body;

    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const menuItem = vendor.menuItems.id(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    if (name !== undefined) menuItem.name = name;
    if (description !== undefined) menuItem.description = description;
    if (price !== undefined) menuItem.price = price;
    if (available !== undefined) menuItem.available = available;

    await vendor.save();

    res.json({
      message: "Menu item updated",
      menuItem,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { menuItemId } = req.params;

    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const menuItem = vendor.menuItems.id(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // delete image from cloudinary
    if (menuItem.image?.publicId) {
      await cloudinary.uploader.destroy(menuItem.image.publicId);
    }

    menuItem.deleteOne();

    await vendor.save();

    res.json({ message: "Menu item deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMyVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.completeOnboarding = async (req, res) => {
  try {
    const {
      businessName,
      street,
      city,
      state,
      country,
      bankName,
      accountNumber,
      accountName,
      zone,
    } = req.body;

    if (
      !businessName ||
      !street ||
      !city ||
      !zone ||
      !bankName ||
      !accountNumber
    ) {
      return res.status(400).json({ message: "All fields required" });
    }

    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.businessName = businessName;

    vendor.address = {
      street,
      city,
      state,
      country,
    };

    vendor.bank = {
      bankName,
      accountNumber,
      accountName,
    };

    vendor.zone = zone;
    vendor.status = "review";
    vendor.onboardingCompleted = true;

    await vendor.save();

    res.json({
      message: "Onboarding completed",
      vendor,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};