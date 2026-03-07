const Vendor = require('../models/Vendor');
const User = require('../models/User')
const Order = require('../models/Order');
const cloudinary = require("../config/cloudinary");

exports.createVendor = async (req, res) => {
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

  await User.findByIdAndUpdate(req.user._id, { role: 'vendor' });

  res.status(201).json({ message: 'Vendor created successfully', vendor });
};

exports.getMyVendor = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  res.json(vendor);
};

exports.updateVendor = async (req, res) => {
  const vendor = await Vendor.findOneAndUpdate(
    { owner: req.user._id },
    req.body,
    { new: true }
  );
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  res.json(vendor);
};

exports.getMyMenu = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  res.json({ menuItems: vendor.menuItems });
};

exports.addMenuItem = async (req, res) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  const { name, description, price } = req.body;
  if (!name || !price) {
    return res.status(400).json({ message: 'Name and price required' });
  }

  vendor.menuItems.push({ name, description, price });
  await vendor.save();

  res.status(201).json({ message: 'Menu item added', menuItems: vendor.menuItems });
};

/**
 * =======================
 * GET DASHBOARD
 * =======================
 */
exports.getDashboard = async (req, res) => {
  const vendor = req.vendor;
  const vendorId = vendor._id;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [ordersToday, activeOrders, totalOrders, revenueResult] = await Promise.all([
    // Orders placed today
    Order.countDocuments({
      vendor: vendorId,
      createdAt: { $gte: startOfDay },
    }),
    // Currently active (not done/cancelled)
    Order.countDocuments({
      vendor: vendorId,
      status: { $in: ['accepted', 'preparing', 'searching_rider', 'rider_assigned', 'arrived_at_pickup', 'picked_up', 'on_the_way'] },
    }),
    // All time total
    Order.countDocuments({ vendor: vendorId }),
    // Total revenue from delivered orders
    Order.aggregate([
      { $match: { vendor: vendorId, status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
  ]);

  const totalRevenue = revenueResult[0]?.total ?? 0;

  res.json({
    vendorId,          // ✅ Flutter uses this for socket room vendor_<vendorId>
    ordersToday,       // ✅ was missing — Flutter dashboard reads this
    activeOrders,      // ✅ was missing — Flutter dashboard reads this
    totalOrders,
    totalRevenue,
    isOpen: vendor.isOpen,
  });
};

exports.getVendors = async (req, res) => {
  const vendors = await Vendor.find(
    { isOpen: true },
    { businessName: 1, isOpen: 1, logo: 1 }
  );
  res.json(vendors);
};

exports.getVendorMenuPublic = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id, {
    menuItems: 1,
    businessName: 1,
    isOpen: 1,
  });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  const menuItems = vendor.menuItems.filter(i => i.available);
  res.json(menuItems);
};

exports.updateLogo = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const { imageUrl, publicId } = req.body;
    if (!imageUrl || !publicId) {
      return res.status(400).json({ message: "Image data required" });
    }

    if (vendor.logo?.publicId) {
      await cloudinary.uploader.destroy(vendor.logo.publicId);
    }

    vendor.logo = { url: imageUrl, publicId };
    await vendor.save();

    res.json({ message: "Logo updated", logo: vendor.logo });
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
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const menuItem = vendor.menuItems.id(menuItemId);
    if (!menuItem) return res.status(404).json({ message: "Menu item not found" });

    if (menuItem.image?.publicId) {
      await cloudinary.uploader.destroy(menuItem.image.publicId);
    }

    menuItem.image = { url: imageUrl, publicId };
    await vendor.save();

    res.json({ message: "Menu item image updated", image: menuItem.image });
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
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const menuItem = vendor.menuItems.id(menuItemId);
    if (!menuItem) return res.status(404).json({ message: "Menu item not found" });

    if (name !== undefined) menuItem.name = name;
    if (description !== undefined) menuItem.description = description;
    if (price !== undefined) menuItem.price = price;
    if (available !== undefined) menuItem.available = available;

    await vendor.save();

    res.json({ message: "Menu item updated", menuItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { menuItemId } = req.params;

    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const menuItem = vendor.menuItems.id(menuItemId);
    if (!menuItem) return res.status(404).json({ message: "Menu item not found" });

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
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.completeOnboarding = async (req, res) => {
  try {
    const { businessName, street, city, state, country, bankName, accountNumber, accountName } = req.body;

    if (!businessName || !street || !city || !bankName || !accountNumber) {
      return res.status(400).json({ message: "All fields required" });
    }

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    vendor.businessName = businessName;
    vendor.address = { street, city, state, country };
    vendor.bank = { bankName, accountNumber, accountName };
    vendor.status = "review";
    vendor.onboardingCompleted = true;

    await vendor.save();

    res.json({ message: "Onboarding completed", vendor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPopularDishes = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const popular = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.menuItemId",
          name: { $first: "$items.name" },
          price: { $first: "$items.price" },
          orderCount: { $sum: "$items.quantity" },
          vendorId: { $first: "$vendor" },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "vendors",
          localField: "vendorId",
          foreignField: "_id",
          as: "vendorData",
        },
      },
      { $unwind: { path: "$vendorData", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          menuItem: {
            $first: {
              $filter: {
                input: { $ifNull: ["$vendorData.menuItems", []] },
                as: "m",
                cond: { $eq: ["$$m._id", "$_id"] },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          orderCount: 1,
          imageUrl: "$menuItem.image.url",
          vendorId: "$vendorData._id",
          vendorName: "$vendorData.businessName",
          vendorLogoUrl: "$vendorData.logo.url",
        },
      },
    ]);

    res.json(popular);
  } catch (err) {
    console.error("GET POPULAR DISHES ERROR:", err);
    res.status(500).json({ message: "Failed to fetch popular dishes" });
  }
};