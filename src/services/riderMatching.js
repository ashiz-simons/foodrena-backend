const Rider = require("../models/Rider");
const Order = require("../models/Order");

const MAX_ASSIGNMENT_ATTEMPTS = 5;
const RESPONSE_TIMEOUT_MS = 30 * 1000; // 30s for rider to accept

// ─── Haversine distance ───────────────────────────────
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ─── Sort riders by distance from pickup ─────────────
function sortByDistance(riders, pickupLat, pickupLng) {
  return riders
    .filter(r => r.currentLocation?.coordinates?.length === 2)
    .map(r => ({
      rider: r,
      distance: getDistanceKm(
        pickupLat,
        pickupLng,
        r.currentLocation.coordinates[1], // lat
        r.currentLocation.coordinates[0]  // lng
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(r => r.rider);
}

// ─── Find eligible riders (zone-first, fallback global) ──
async function findEligibleRiders(order) {
  const [pickupLng, pickupLat] = order.pickupLocation.coordinates;

  // Try zone-matched riders first
  let riders = await Rider.find({
    isAvailable: true,
    isActive: true,
    zone: order.zone,
    "currentLocation.coordinates": { $exists: true },
  });

  if (riders.length > 0) {
    console.log(`✅ Found ${riders.length} riders in zone ${order.zone}`);
    return sortByDistance(riders, pickupLat, pickupLng);
  }

  // Fallback: any available rider
  console.log(`⚠️ No riders in zone ${order.zone}, expanding search...`);
  riders = await Rider.find({
    isAvailable: true,
    isActive: true,
    "currentLocation.coordinates": { $exists: true },
  });

  return sortByDistance(riders, pickupLat, pickupLng);
}

// ─── Try assigning a single rider, wait for acceptance ──
async function tryAssignRider(order, rider) {
  // Atomically claim the order for this rider
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "searching_rider", rider: null },
    {
      $set: { rider: rider._id, status: "rider_assigned" },
      $inc: { assignmentAttempts: 1 },
    },
    { new: true }
  );

  if (!updated) return false; // order was already taken or cancelled

  console.log(`📡 Notifying rider ${rider._id} of order ${order._id}`);

  global.io?.to(`rider_${rider._id}`).emit("new_order", {
    orderId: updated._id,
    pickupLocation: updated.pickupLocation,
    items: updated.items,
    total: updated.total,
  });

  // Wait for rider to accept (move status forward) or timeout
  return new Promise(resolve => {
    setTimeout(async () => {
      try {
        const fresh = await Order.findById(updated._id);

        if (!fresh) return resolve(false);

        // Rider accepted — status moved past rider_assigned
        if (fresh.status !== "rider_assigned") return resolve(true);

        // Timed out — reset for next rider
        console.log(`⏱ Rider ${rider._id} timed out, reassigning...`);
        await Order.findOneAndUpdate(
          { _id: order._id, status: "rider_assigned", rider: rider._id },
          { $set: { rider: null, status: "searching_rider" } }
        );

        resolve(false);
      } catch (err) {
        console.error("tryAssignRider timeout error:", err.message);
        resolve(false);
      }
    }, RESPONSE_TIMEOUT_MS);
  });
}

// ─── Main export ──────────────────────────────────────
exports.assignRiderToOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      console.warn(`assignRiderToOrder: order ${orderId} not found`);
      return null;
    }

    if (!["searching_rider", "rider_assigned"].includes(order.status)) {
      console.log(`assignRiderToOrder: order ${orderId} not in searchable state (${order.status})`);
      return null;
    }

    // Check pickup location — uses GeoJSON coordinates [lng, lat]
    if (!order.pickupLocation?.coordinates?.length) {
      console.error(`assignRiderToOrder: order ${orderId} missing pickupLocation coordinates`);
      return null;
    }

    if (order.assignmentAttempts >= MAX_ASSIGNMENT_ATTEMPTS) {
      console.warn(`Order ${orderId} exceeded max assignment attempts`);
      order.status = "cancelled";
      order.cancelledAt = new Date();
      await order.save();

      global.io?.to(`order_${order._id}`).emit("order_status_update", {
        orderId: order._id,
        status: "cancelled",
        reason: "No riders available",
      });

      return null;
    }

    const riders = await findEligibleRiders(order);

    if (!riders.length) {
      console.warn(`No eligible riders found for order ${orderId}`);

      // Retry after 60s
      setTimeout(() => exports.assignRiderToOrder(orderId), 60 * 1000);
      return null;
    }

    for (const rider of riders) {
      const success = await tryAssignRider(order, rider);

      if (success) {
        console.log(`✅ Rider ${rider._id} accepted order ${orderId}`);

        global.io?.to(`order_${order._id}`).emit("rider_assigned", {
          riderId: rider._id,
          orderId: order._id,
        });

        return rider;
      }
    }

    // All riders in this batch declined/timed out — retry recursively
    console.log(`🔄 All riders declined order ${orderId}, retrying...`);
    return exports.assignRiderToOrder(orderId);

  } catch (err) {
    console.error("assignRiderToOrder error:", err.message);
    return null;
  }
};