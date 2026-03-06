const Rider = require("../models/Rider");
const Order = require("../models/Order");

const MAX_ASSIGNMENT_ATTEMPTS = 5;
const RESPONSE_TIMEOUT_MS = 30 * 1000;       // 30s per rider
const MAX_SEARCH_DURATION_MS = 30 * 60 * 1000; // 30 min total
const RETRY_INTERVAL_MS = 60 * 1000;          // retry every 60s

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

function sortByDistance(riders, pickupLat, pickupLng) {
  return riders
    .filter(r => Array.isArray(r.currentLocation?.coordinates) &&
                 r.currentLocation.coordinates.length === 2)
    .map(r => ({
      rider: r,
      distance: getDistanceKm(
        pickupLat, pickupLng,
        r.currentLocation.coordinates[1],
        r.currentLocation.coordinates[0]
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(r => r.rider);
}

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

async function findEligibleRiders(order) {
  const pickup = getPickupCoords(order);
  if (!pickup) {
    console.error(`❌ Cannot read pickupLocation for order ${order._id}`);
    return [];
  }

  const { lat, lng } = pickup;
  const baseQuery = { isAvailable: true, isActive: true };

  try {
    const nearbyRiders = await Rider.find({
      ...baseQuery,
      currentLocation: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 10000,
        },
      },
    });

    if (nearbyRiders.length > 0) {
      console.log(`📍 Found ${nearbyRiders.length} riders within 10km of vendor`);
      return nearbyRiders;
    }

    console.warn(`⚠️ No riders within 10km, expanding to 50km...`);

    const widerRiders = await Rider.find({
      ...baseQuery,
      currentLocation: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 50000,
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

  console.warn(`🌍 No nearby riders — using all available riders`);
  const allRiders = await Rider.find(baseQuery);
  return sortByDistance(allRiders, lat, lng);
}

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

// ─── Cancel order and refund customer ────────────────
async function cancelWithRefund(order, reason) {
  try {
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.refundReason = reason;
    await order.save();

    // Trigger refund if paid
    if (order.paymentStatus === "paid" && order.refundStatus === "none") {
      
      // Use the same safe refund helper from orderController
      order.refundStatus = "pending";
      await order.save();
      try {
        const { refundTransaction } = require("./payments/paystack");
      await refundTransaction(order.reference);
      } catch (refundErr) {
        console.error("❌ Refund failed:", refundErr.message);
        order.refundStatus = "failed";
        await order.save();
      }
    }

    global.io?.to(`order_${order._id}`).emit("order_status_update", {
      orderId: order._id,
      status: "cancelled",
      reason,
    });

    console.log(`🚫 Order ${order._id} cancelled — ${reason}`);
  } catch (err) {
    console.error("cancelWithRefund error:", err.message);
  }
}

// ─── Main entry point ─────────────────────────────────
exports.assignRiderToOrder = async (orderId, searchStartedAt) => {
  try {
    // ✅ Track when we first started searching
    const startedAt = searchStartedAt || Date.now();
    const elapsed = Date.now() - startedAt;

    const order = await Order.findById(orderId);

    if (!order) {
      console.warn(`assignRiderToOrder: order ${orderId} not found`);
      return null;
    }

    if (!["searching_rider", "rider_assigned"].includes(order.status)) {
      console.log(`assignRiderToOrder: order ${orderId} not searchable (${order.status})`);
      return null;
    }

    // ✅ Give up after 30 minutes and refund
    if (elapsed >= MAX_SEARCH_DURATION_MS) {
      console.warn(`⏰ Order ${orderId} — no rider found after 30 minutes, refunding customer`);
      await cancelWithRefund(order, "No riders available after 30 minutes");
      return null;
    }

    if (!order.pickupLocation) {
      console.error(`assignRiderToOrder: order ${orderId} missing pickupLocation`);
      return null;
    }

    if (order.assignmentAttempts >= MAX_ASSIGNMENT_ATTEMPTS) {
      // Don't cancel yet — reset attempts and keep searching until 30 min
      console.warn(`⚠️ Order ${orderId} hit max attempts — resetting counter and retrying`);
      await Order.findByIdAndUpdate(orderId, { $set: { assignmentAttempts: 0 } });
    }

    const riders = await findEligibleRiders(order);

    if (!riders.length) {
      const remainingMs = MAX_SEARCH_DURATION_MS - elapsed;
      const retryIn = Math.min(RETRY_INTERVAL_MS, remainingMs);

      console.warn(`No eligible riders for order ${orderId} — retrying in ${Math.round(retryIn / 1000)}s`);

      if (retryIn > 0) {
        setTimeout(
          () => exports.assignRiderToOrder(orderId, startedAt),
          retryIn
        );
      } else {
        await cancelWithRefund(order, "No riders available after 30 minutes");
      }
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

    // All riders declined — retry with time tracking
    const remainingMs = MAX_SEARCH_DURATION_MS - elapsed;
    if (remainingMs > 0) {
      console.log(`🔄 All riders declined order ${orderId} — retrying`);
      setTimeout(
        () => exports.assignRiderToOrder(orderId, startedAt),
        Math.min(RETRY_INTERVAL_MS, remainingMs)
      );
    } else {
      await cancelWithRefund(order, "No riders available after 30 minutes");
    }

    return null;

  } catch (err) {
    console.error("assignRiderToOrder error:", err.message);
    return null;
  }
};