require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');
const Vendor = require('./models/Vendor');
const MenuItem = require('./models/MenuItem');

async function seed() {
  await connectDB(process.env.MONGO_URI);
  await User.deleteMany({});
  const admin = await User.create({ name: 'Admin', email: 'admin@foodrena.test', password: 'password', role: 'admin' });
  const vendorUser = await User.create({ name: 'Vendor', email: 'vendor@foodrena.test', password: 'password', role: 'vendor' });
  const vendor = await Vendor.create({ user: vendorUser._id, businessName: 'FoodRena Kitchen', address: 'Street 1', phone: '08000000000', location: { type: 'Point', coordinates: [3.3792,6.5244] } });
  await MenuItem.create({ vendor: vendor._id, name: 'Jollof Rice', description: 'Tasty', price: 1200 });
  console.log('Seeded data');
  process.exit(0);
}

seed().catch(err => console.error(err));
