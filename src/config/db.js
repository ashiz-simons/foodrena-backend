const mongoose = require('mongoose');
const logger = console;

async function connectDB(uri) {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    logger.log('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error', err);
    process.exit(1);
  }
}

module.exports = connectDB;
