require('dotenv').config();
require('express-async-errors');
require('./workers/orderListener');

const express = require('express');
const http = require('http');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const { Server } = require("socket.io");

const connectDB = require('./config/db');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const ensureIndexes = require('./utils/ensureIndexes'); // ✅ added

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
const unlockRiderEarnings = require("./jobs/unlockRiderEarnings");
const riderTrackingSocket = require("./sockets/riderTracking");
const uploadRoutes = require('./routes/upload');
const startKeepAlive = require("./utils/keepAlive");

setInterval(unlockRiderEarnings, 5 * 60 * 1000);

const unlockEarnings = require('./jobs/unlockEarnings');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/auth", require("./routes/adminAuth.routes"));
app.use("/api/admin/analytics", require("./routes/adminAnalytics.routes"));
app.use("/api/admin/earnings", require("./routes/adminEarnings.routes"));
app.use("/api/admin/withdrawals", require("./routes/adminWithdrawals.routes"));
app.use("/api/admin/orders", require("./routes/adminOrders.routes"));
app.use('/api/riders', require('./routes/riderRoutes'));
app.use("/api/admin/rider-withdrawals", require("./routes/adminRiderWithdrawals.routes"));
app.use('/api/vendor-wallet', require('./routes/vendorWallet'));
app.use('/api/users', require('./routes/users'));
app.use('/api/upload', uploadRoutes);
app.use('/api/users', require('./routes/fcmTokenRoutes'));
app.use("/api/ratings", require("./routes/ratingRoutes"));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date() });
});

app.use(errorHandler);

setInterval(unlockEarnings, 5 * 60 * 1000);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

global.io = io;

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`📡 Joined room: ${room}`);
  });

  riderTrackingSocket(io, socket);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

const PORT = config.port || 4000;

connectDB(config.mongoUri)
  .then(async () => {
    await ensureIndexes(); // ✅ recreates 2dsphere indexes after any db wipe
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 API + Socket.IO running on port ${PORT}`);
      startKeepAlive();
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed', err);
    process.exit(1);
  });

module.exports = app;