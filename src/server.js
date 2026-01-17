require('dotenv').config();
require('express-async-errors');
require('./workers/orderListener');

const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const connectDB = require('./config/db');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const orderRoutes = require('./routes/orders');
const tokenRoutes = require('./routes/token');
const verificationRoutes = require('./routes/verification');
const paymentRoutes = require('./routes/payments');
const walletRoutes = require('./routes/wallet');
const withdrawalRoutes = require('./routes/withdrawals');
const adminRoutes = require('./routes/admin');
const adminSettingsRoutes = require("./routes/adminSettings.routes");

const unlockEarnings = require('./jobs/unlockEarnings');

const app = express();

/**
 * =======================
 * GLOBAL MIDDLEWARE
 * =======================
 */
app.use(helmet());
app.use(cors());

// JSON parser (SAFE — webhook handled in route)
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

/**
 * =======================
 * ROUTES
 * =======================
 */
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/payments', paymentRoutes);     // webhook handled inside route
app.use('/api/wallet', walletRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/auth", require("./routes/adminAuth.routes"));
app.use("/api/admin/analytics", require("./routes/adminAnalytics.routes"));
app.use("/api/admin/earnings", require("./routes/adminEarnings.routes"));

/**
 * =======================
 * HEALTH
 * =======================
 */
app.get('/health', (req, res) => res.json({ ok: true }));

/*
 ERROR HANDLER (LAST)
 */
app.use(errorHandler);

/**
 * =======================
 * BACKGROUND JOBS
 * =======================
 */
setInterval(unlockEarnings, 5 * 60 * 1000);

/**
 * =======================
 * START SERVER
 * =======================
 */
const PORT = config.port || 4000;

connectDB(config.mongoUri)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 API listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed', err);
    process.exit(1);
  });

module.exports = app;