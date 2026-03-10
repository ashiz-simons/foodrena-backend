const Rider = require("../models/Rider");
const Order = require("../models/Order");
const { notifyRider, notifyCustomer } = require("../utils/notifyHelpers");

const MAX_ASSIGNMENT_ATTEMPTS = 5;
const RESPONSE_TIMEOUT_MS = 30 * 1000;
const MAX_SEARCH_DURATION_MS = 30 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 1000;

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

/**
 * Extract pickup coordinates from order.
 * Handles both formats:
 *   - { lat, lng }              ← food orders (vendor location)
 *   - { coordinates: [lng, lat] } ← GeoJSON
 * For package orders, falls back to pickupLocation directly.
 */
function getPickupCoords(order) {
  const loc = order.pickupLocation;
  if (!loc) {
    // Package orders: try deliveryLocation as last resort (shouldn't happen)
    console.error(`❌ Order ${order._id} (${order.type}) has no pickupLocation`);
    return null;
  }

  // Format 1: { lat, lng } — food orders and package orders from Flutter
  if (loc.lat !== undefined && loc.lng !== undefined) {
    const lat = parseFloat(loc.lat);
    const lng = parseFloat(loc.lng);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Format 2: GeoJSON { coordinates: [lng, lat] }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }

  console.error(`❌ Could not parse pickupLocation for order ${order._id}:`, JSON.stringify(loc));
  return null;
}

async function findEligibleRiders(order) {
  const pickup = getPickupCoords(order);
  if (!pickup) return [];

  const { lat, lng } = pickup;
  const baseQuery = { isAvailable: true, isActive: true };

  console.log(`🔍 Searching riders near [${lat}, ${lng}] for order ${order._id} (type: ${order.type || 'food'})`);

  try {
    const nearbyRiders = await Rider.find({
      ...baseQuery,
      currentLocation: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 10000, // 10km
        },
      },
    });

    if (nearbyRiders.length > 0) {
      console.log(`📍 Found ${nearbyRiders.length} riders within 10km`);
      return nearbyRiders;
    }

    console.warn(`⚠️ No riders within 10km, expanding to 50km...`);

    const widerRiders = await Rider.find({
      ...baseQuery,
      currentLocation: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 50000, // 50km
        },
      },
    });

    if (widerRiders.length > 0) {
      console.log(`📍 Found ${widerRiders.length} riders within 50km`);
      return widerRiders;
    }
  } catch (geoErr) {
    console.warn("⚠️ Geo query failed, using manual distance sort:", geoErr.message);
  }

  console.warn(`🌍 No nearby riders — falling back to all available riders`);
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

  console.log(`📡 Notifying rider ${rider._id} of order ${order._id} (type: ${order.type || 'food'})`);

  // Socket notification
  global.io?.to(`rider_${rider._id}`).emit("new_order", {
    orderId: updated._id,
    type: updated.type || "food",
    pickupLocation: updated.pickupLocation,
    deliveryAddress: updated.deliveryAddress,
    items: updated.items,
    packageDetails: updated.packageDetails,
    total: updated.total,
    deliveryFee: updated.deliveryFee,
  });

  // Push notification
  const isPackage = (updated.type || "food") === "package";
  await notifyRider(rider._id, {
    title: isPackage ? "📦 New Package Delivery!" : "🛵 New Delivery Request!",
    body: `₦${updated.deliveryFee} delivery fee. Tap to view.`,
    orderId: updated._id,
  });

  return new Promise(resolve => {
    setTimeout(async () => {
      try {
        const fresh = await Order.findById(updated._id);
        if (!fresh) return resolve(false);
        if (fresh.status !== "rider_assigned") return resolve(true);

        console.log(`⏱ Rider ${rider._id} timed out on order ${order._id}`);
        await Order.findOneAndUpdate(
          { _id: order._id, status: "rider_assigned", rider: rider._id },
          { $set: { rider: null, status: "searching_rider" } }
        );

        await Rider.findByIdAndUpdate(rider._id, { isAvailable: true });
        resolve(false);
      } catch (err) {
        console.error("tryAssignRider timeout error:", err.message);
        resolve(false);
      }
    }, RESPONSE_TIMEOUT_MS);
  });
}

async function cancelWithRefund(order, reason) {
  try {
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.refundReason = reason;
    await order.save();

    if (order.paymentStatus === "paid" && order.refundStatus === "none") {
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

    await notifyCustomer(order.user, {
      title: "❌ Order Cancelled",
      body: "We couldn't find a rider for your order. A refund has been initiated.",
      orderId: order._id,
    });

    console.log(`🚫 Order ${order._id} cancelled — ${reason}`);
  } catch (err) {
    console.error("cancelWithRefund error:", err.message);
  }
}

exports.assignRiderToOrder = async (orderId, searchStartedAt) => {
  try {
    const startedAt = searchStartedAt || Date.now();
    const elapsed = Date.now() - startedAt;

    const order = await Order.findById(orderId);

    if (!order) {
      console.warn(`assignRiderToOrder: order ${orderId} not found`);
      return null;
    }

    // Accept both searching_rider (normal flow) and pending (legacy)
    if (!["searching_rider", "pending"].includes(order.status)) {
      console.log(`assignRiderToOrder: order ${orderId} not searchable — status: ${order.status}`);
      return null;
    }

    // Ensure we're in searching_rider before proceeding
    if (order.status === "pending") {
      await Order.findByIdAndUpdate(orderId, { $set: { status: "searching_rider" } });
      order.status = "searching_rider";
    }

    if (elapsed >= MAX_SEARCH_DURATION_MS) {
      console.warn(`⏰ Order ${orderId} — no rider found after 30 minutes`);
      await cancelWithRefund(order, "No riders available after 30 minutes");
      return null;
    }

    if (!order.pickupLocation) {
      console.error(`assignRiderToOrder: order ${orderId} missing pickupLocation`);
      return null;
    }

    if (order.assignmentAttempts >= MAX_ASSIGNMENT_ATTEMPTS) {
      console.warn(`⚠️ Order ${orderId} hit max attempts — resetting counter`);
      await Order.findByIdAndUpdate(orderId, { $set: { assignmentAttempts: 0 } });
    }

    const riders = await findEligibleRiders(order);

    if (!riders.length) {
      const remainingMs = MAX_SEARCH_DURATION_MS - elapsed;
      const retryIn = Math.min(RETRY_INTERVAL_MS, remainingMs);

      console.warn(`No eligible riders for order ${orderId} — retrying in ${Math.round(retryIn / 1000)}s`);

      if (retryIn > 0) {
        setTimeout(() => exports.assignRiderToOrder(orderId, startedAt), retryIn);
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