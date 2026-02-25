const Rider = require("../models/Rider");
const Order = require("../models/Order");

const MAX_ASSIGNMENT_ATTEMPTS = 5;
const RESPONSE_TIMEOUT_MS = 30 * 1000;

/**
 * Calculate distance between coordinates (Haversine)
 */
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function findEligibleRiders(order) {
  const riders = await Rider.find({
    isAvailable: true,
    currentLocation: { $exists: true },
  });

  if (!riders.length) return [];

  return riders
    .map(rider => ({
      rider,
      distance: getDistanceKm(
        order.pickupLocation.lat,
        order.pickupLocation.lng,
        rider.currentLocation.lat,
        rider.currentLocation.lng
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(r => r.rider);
}

async function tryAssignRider(order, rider) {
  order.rider = rider.user;
  order.status = "rider_assigned";
  order.assignmentAttempts += 1;
  await order.save();

  // ✅ SINGLE, CONSISTENT EVENT
  global.io?.to(`rider_${rider.user}`).emit("new_order", {
    orderId: order._id
  });

  return new Promise(resolve => {
    setTimeout(async () => {
      const refreshed = await Order.findById(order._id);

      if (refreshed.status === "rider_assigned") {
        refreshed.rider = null;
        refreshed.status = "searching_rider";
        await refreshed.save();
        return resolve(false);
      }

      resolve(true);
    }, RESPONSE_TIMEOUT_MS);
  });
}

exports.assignRiderToOrder = async (orderId) => {
  let order = await Order.findById(orderId);
  if (!order || !order.pickupLocation?.lat) return null;

  order.assignmentAttempts ||= 0;

  if (order.assignmentAttempts >= MAX_ASSIGNMENT_ATTEMPTS) {
    order.status = "cancelled";
    await order.save();
    return null;
  }

  order.status = "searching_rider";
  await order.save();

  const riders = await findEligibleRiders(order);
  if (!riders.length) return null;

  for (const rider of riders) {
    const success = await tryAssignRider(order, rider);

    if (success) {
      // Notify customer only (MVP)
      global.io?.to(`order_${order._id}`).emit("rider_assigned", {
        riderId: rider.user,
        orderId: order._id
      });

      return rider;
    }
  }

  return exports.assignRiderToOrder(orderId);
};
