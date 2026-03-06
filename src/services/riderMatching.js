const Rider = require("../models/Rider");
const Order = require("../models/Order");

const MAX_ASSIGNMENT_ATTEMPTS = 5;
const RESPONSE_TIMEOUT_MS = 30 * 1000;

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
    .filter(r => {
      // Support both GeoJSON {coordinates: [lng, lat]}
      // and legacy {lat, lng} storage
      const coords = r.currentLocation?.coordinates;
      const hasGeo = Array.isArray(coords) && coords.length === 2;
      const hasLatLng =
        r.currentLocation?.lat !== undefined &&
        r.currentLocation?.lng !== undefined;
      return hasGeo || hasLatLng;
    })
    .map(r => {
      let riderLat, riderLng;
      if (Array.isArray(r.currentLocation?.coordinates)) {
        [riderLng, riderLat] = r.currentLocation.coordinates; // GeoJSON: [lng, lat]
      } else {
        riderLat = r.currentLocation.lat;
        riderLng = r.currentLocation.lng;
      }
      return {
        rider: r,
        distance: getDistanceKm(pickupLat, pickupLng, riderLat, riderLng),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .map(r => r.rider);
}

// ─── Extract pickup lat/lng from order (handles both formats) ──
function getPickupCoords(order) {
  const loc = order.pickupLocation;
  if (!loc) return null;

  // GeoJSON format: { type: "Point", coordinates: [lng, lat] }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }

  // Flat format: { lat, lng }
  if (loc.lat !== undefined && loc.lng !== undefined) {
    return { lat: loc.lat, lng: loc.lng };
  }

  return null;
}

// ─── Find eligible riders sorted by proximity ──
async function findEligibleRiders(order) {
  const pickup = getPickupCoords(order);
  if (!pickup) {
    console.error(`assignRiderToOrder: cannot read pickupLocation for order ${order._id}`);
    return [];
  }

  const { lat: pickupLat, lng: pickupLng } = pickup;

  // Build base query — available and active
  const baseQuery = { isAvailable: true, isActive: true };

  // Try zone-matched riders first (if order has a zone)
  if (order.zone) {
    const zoneRiders = await Rider.find({ ...baseQuery, zone: order.zone });
    if (zoneRiders.length > 0) {
      console.log(`✅ Found ${zoneRiders.length} riders in zone ${order.zone}`);
      return sortByDistance(zoneRiders, pickupLat, pickupLng);
    }
    console.log(`⚠️ No riders in zone ${order.zone}, expanding search...`);
  }

  // Fallback: geo query within 10km of pickup using $nearSphere
  // This works if riders have proper GeoJSON currentLocation
  try {
    const nearbyRiders = await Rider.find({
      ...baseQuery,
      currentLocation: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [pickupLng, pickupLat],
          },
          $maxDistance: 10000, // 10km in meters
        },
      },
    });

    if (nearbyRiders.length > 0) {
      console.log(`📍 Found ${nearbyRiders.length} nearby riders via geo query`);
      return nearbyRiders; // already sorted by distance by $nearSphere
    }
  } catch (geoErr) {
    console.warn("Geo query failed, falling back to manual sort:", geoErr.message);
  }

  // Final fallback: any available rider, sorted manually
  const allRiders = await Rider.find(baseQuery);
  console.log(`🌍 Fallback: using all ${allRiders.length} available riders`);
  return sortByDistance(allRiders, pickupLat, pickupLng);
}

// ─── Try assigning a single rider, wait for acceptance ──
async function tryAssignRider(order, rider) {
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "searching_rider", rider: null },
    {
      $set: { rider: rider._id, status: "rider_assigned" },
      $inc: { assignmentAttempts: 1 },
    },
    { new: true }
  );

  if (!updated) return false;

  console.log(`📡 Notifying rider ${rider._id} of order ${order._id}`);

  // Notify the rider via their personal socket room
  global.io?.to(`rider_${rider._id}`).emit("new_order", {
    orderId: updated._id,
    pickupLocation: updated.pickupLocation,
    dropoffLocation: updated.dropoffLocation,
    items: updated.items,
    total: updated.total,
    deliveryFee: updated.deliveryFee,
  });

  return new Promise(resolve => {
    setTimeout(async () => {
      try {
        const fresh = await Order.findById(updated._id);
        if (!fresh) return resolve(false);

        if (fresh.status !== "rider_assigned") return resolve(true);

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
      console.log(`assignRiderToOrder: order ${orderId} not searchable (${order.status})`);
      return null;
    }

    if (!order.pickupLocation) {
      console.error(`assignRiderToOrder: order ${orderId} missing pickupLocation`);
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
      console.warn(`No eligible riders for order ${orderId}, retrying in 60s`);
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

    console.log(`🔄 All riders declined order ${orderId}, retrying...`);
    return exports.assignRiderToOrder(orderId);

  } catch (err) {
    console.error("assignRiderToOrder error:", err.message);
    return null;
  }
};