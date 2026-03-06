/**
 * Run this ONCE after wiping the database to recreate all geospatial indexes.
 * Add this call to your server startup (app.js / server.js) after mongoose.connect()
 *
 * Usage: called automatically on startup via ensureIndexes()
 */

const mongoose = require("mongoose");

async function ensureIndexes() {
  try {
    // Rider currentLocation 2dsphere index
    await mongoose.connection.db
      .collection("riders")
      .createIndex({ currentLocation: "2dsphere" });
    console.log("✅ riders.currentLocation 2dsphere index ensured");

    // User location 2dsphere index
    await mongoose.connection.db
      .collection("users")
      .createIndex({ location: "2dsphere" });
    console.log("✅ users.location 2dsphere index ensured");

    // Vendor location 2dsphere index
    await mongoose.connection.db
      .collection("vendors")
      .createIndex({ location: "2dsphere" });
    console.log("✅ vendors.location 2dsphere index ensured");

    // Orders zone index
    await mongoose.connection.db
      .collection("orders")
      .createIndex({ zone: 1 });
    console.log("✅ orders.zone index ensured");

  } catch (err) {
    console.error("❌ ensureIndexes error:", err.message);
  }
}

module.exports = ensureIndexes;