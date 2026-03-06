const Rider = require("../models/Rider");
const Order = require("../models/Order");

module.exports = (io, socket) => {
  console.log("📡 Rider socket ready:", socket.id);

  // ─── Rider goes online ────────────────────────────────
  socket.on("rider_online", async ({ riderId }) => {
    try {
      if (!riderId) return;

      await Rider.findOneAndUpdate(
        { _id: riderId, isActive: true },
        { isAvailable: true, lastSeen: new Date() }
      );

      socket.join(`rider_${riderId}`);
      console.log("🟢 Rider online:", riderId);
    } catch (err) {
      console.error("❌ rider_online error:", err.message);
    }
  });

  // ─── Join order room ──────────────────────────────────
  socket.on("join_order_room", ({ orderId }) => {
    if (!orderId) return;
    socket.join(`order_${orderId}`);
  });

  // ─── Rider sends live GPS update ──────────────────────
  // Flutter emits: { riderId, lat, lng }
  socket.on("rider_location_update", async ({ riderId, lat, lng }) => {
    try {
      if (!riderId || lat === undefined || lng === undefined) return;

      // Save as proper GeoJSON so $nearSphere queries work
      const rider = await Rider.findByIdAndUpdate(
        riderId,
        {
          currentLocation: {
            type: "Point",
            coordinates: [lng, lat], // GeoJSON is [lng, lat]
          },
          lastActiveAt: new Date(),
        },
        { new: true }
      );

      if (!rider) return;

      // Find active order for this rider
      const activeOrder = await Order.findOne({
        rider: riderId,
        status: { $in: ["rider_assigned", "arrived_at_pickup", "picked_up", "on_the_way"] },
      });

      // Broadcast to admin dashboard
      io.emit("rider_location_update", {
        riderId,
        lat,
        lng,
        updatedAt: new Date(),
      });

      // Echo back to rider's own room
      io.to(`rider_${riderId}`).emit("rider_location_update", { lat, lng });

      // ✅ Emit to the customer's order room as "rider_live_location"
      // OrderStatusScreen listens for this event
      if (activeOrder) {
        io.to(`order_${activeOrder._id}`).emit("rider_live_location", {
          riderId,
          lat,
          lng,
          orderId: activeOrder._id,
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      console.error("❌ rider_location_update error:", err.message);
    }
  });

  // ─── Rider goes offline ───────────────────────────────
  socket.on("rider_offline", async ({ riderId }) => {
    try {
      if (!riderId) return;
      await Rider.findByIdAndUpdate(riderId, {
        isAvailable: false,
        lastSeen: new Date(),
      });
      console.log("🔴 Rider offline:", riderId);
    } catch (err) {
      console.error("❌ rider_offline error:", err.message);
    }
  });
};