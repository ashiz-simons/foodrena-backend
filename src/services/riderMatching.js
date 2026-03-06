const Rider = require("../models/Rider");
const Order = require("../models/Order");

const MAX_ASSIGNMENT_ATTEMPTS = 5;
const RESPONSE_TIMEOUT_MS = 30 * 1000;

// ─── Haversine distance (fallback sort) ──────────────
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

// ─── Manual distance sort (used if geo index fails) ──
function sortByDistance(riders, pickupLat, pickupLng) {
  return riders
    .filter(r => {
      const coords = r.currentLocation?.coordinates;
      return Array.isArray(coords) && coords.length === 2;
    })
    .map(r => ({
      rider: r,
      distance: getDistanceKm(
        pickupLat, pickupLng,
        r.currentLocation.coordinates[1], // lat
        r.currentLocation.coordinates[0]  // lng
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(r => r.rider);
}

// ─── Extract pickup coords from order ────────────────
// Handles both {lat, lng} and GeoJSON {coordinates: [lng, lat]}
function getPickupCoords(order) {
  const loc = order.pickupLocation;
  if (!loc) return null;

  if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }

  if (loc.lat !== undefined && loc.lng !== undefined) {
    return { lat: loc.lat, lng: loc.lng };
  }

  return null;
}

// ─── Find riders sorted by proximity to vendor ───────
async function findEligibleRiders(order) {
  const pickup = getPickupCoords(order);
  if (!pickup) {
    console.error(`❌ Cannot read pickupLocation for order ${order._id}`);
    return [];
  }

  const { lat, lng } = pickup;
  const baseQuery = { isAvailable: true, isActive: true };

  // Primary: geo query — finds available riders within 10km,
  // already sorted nearest-first by MongoDB
  try {
    const nearbyRiders = await Rider.find({
      ...baseQuery,
      currentLocation: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat], // GeoJSON: [lng, lat]
          },
          $maxDistance: 10000, // 10km in metres
        },
      },
    });

    if (nearbyRiders.length > 0) {
      console.log(`📍 Found ${nearbyRiders.length} riders within 10km of vendor`);
      return nearbyRiders;
    }

    console.warn(`⚠️ No riders within 10km, expanding to 50km...`);

    // Secondary: widen search to 50km
    const widerRiders = await Rider.find({
      ...baseQuery,
      currentLocation: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: 50000, // 50km
        },
      },
    });

    if (widerRiders.length > 0) {
      console.log(`📍 Found ${widerRiders.length} riders within 50km`);
      return widerRiders;
    }
  } catch (geoErr) {
    console.warn("⚠️ Geo query failed, using manual sort:", geoErr.message);
  }

  // Final fallback: all available riders sorted manually
  console.warn(`🌍 No nearby riders — using all available riders`);
  const allRiders = await Rider.find(baseQuery);
  return sortByDistance(allRiders, lat, lng);
}

// ─── Offer order to one rider, wait for response ─────
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

  if (!updated) return false; // already taken or cancelled

  console.log(`📡 Notifying rider ${rider._id} of order ${order._id}`);

  global.io?.to(`rider_${rider._id}`).emit("new_order", {
    orderId: updated._id,
    pickupLocation: updated.pickupLocation,
    dropoffLocation: updated.dropoffLocation,
    items: updated.items,
    total: updated.total,
    deliveryFee: updated.deliveryFee,
  });

  // Wait for rider to accept (status moves forward) or timeout
  return new Promise(resolve => {
    setTimeout(async () => {
      try {
        const fresh = await Order.findById(updated._id);
        if (!fresh) return resolve(false);

        if (fresh.status !== "rider_assigned") return resolve(true); // accepted

        // Timed out — reset and try next rider
        console.log(`⏱ Rider ${rider._id} timed out`);
        await Order.findOneAndUpdate(
          { _id: order._id, status: "rider_assigned", rider: rider._id },
          { $set: { rider: null, status: "searching_rider" } }
        );

        resolve(false);
      } catch (err) {
        console.error("tryAssignRider error:", err.message);
        resolve(false);
      }
    }, RESPONSE_TIMEOUT_MS);
  });
}

// ─── Main entry point ─────────────────────────────────
exports.assignRiderToOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      console.warn(`assignRiderToOrder: order ${orderId} not found`);
      return null;
    }

    if (!["searching_rider", "rider_assigned"].includes(order.status)) {
      console.log(`assignRiderToOrder: order ${orderId} not searchable (${order.status})`);
      return null;
    }

    if (!order.pickupLocation) {
      console.error(`assignRiderToOrder: order ${orderId} missing pickupLocation`);
      return null;
    }

    if (order.assignmentAttempts >= MAX_ASSIGNMENT_ATTEMPTS) {
      console.warn(`Order ${orderId} exceeded max attempts — cancelling`);
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
      console.warn(`No eligible riders for order ${orderId} — retrying in 60s`);
      setTimeout(() => exports.assignRiderToOrder(orderId), 60 * 1000);
      return null;
    }

    for (const rider of riders) {
      const success = await tryAssignRider(order, rider);

      if (success) {
        console.log(`✅ Rider ${rider._id} accepted order ${orderId}`);

        global.io?.to(`order_${order._id}`).emit("order_status_update", {
          orderId: order._id,
          status: "rider_assigned",
          riderId: rider._id,
        });

        return rider;
      }
    }

    // All riders declined/timed out — retry
    console.log(`🔄 All riders declined order ${orderId} — retrying`);
    return exports.assignRiderToOrder(orderId);

  } catch (err) {
    console.error("assignRiderToOrder error:", err.message);
    return null;
  }
};