const Rider = require("../models/Rider");
const Order = require("../models/Order");

const MAX_ASSIGNMENT_ATTEMPTS = 5;
const RESPONSE_TIMEOUT_MS = 30 * 1000;

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
    isActive: true,
    zone: order.zone, // 👈 FILTER BY ZONE
    currentLocation: { $exists: true }
  });

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

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "searching_rider",
      rider: null
    },
    {
      $set: {
        rider: rider._id,
        status: "rider_assigned"
      },
      $inc: { assignmentAttempts: 1 }
    },
    { new: true }
  );

  if (!updated) return false;

  global.io?.to(`rider_${rider._id}`).emit("new_order", {
    orderId: updated._id,
    pickupLocation: updated.pickupLocation
  });

  return new Promise(resolve => {
    setTimeout(async () => {
      const fresh = await Order.findById(updated._id);

      if (fresh.status === "rider_assigned") {
        fresh.rider = null;
        fresh.status = "searching_rider";
        await fresh.save();
        return resolve(false);
      }

      resolve(true);
    }, RESPONSE_TIMEOUT_MS);
  });
}

exports.assignRiderToOrder = async (orderId) => {
  let order = await Order.findById(orderId);
  if (!order || !order.pickupLocation?.lat) return null;

  if (order.assignmentAttempts >= MAX_ASSIGNMENT_ATTEMPTS) {
    order.status = "cancelled";
    await order.save();
    return null;
  }

  order.status = "searching_rider";
  await order.save();

  const riders = await findEligibleRiders(order);
    if (!riders.length) {
    console.log("No riders in zone, expanding search...");
    
    const fallbackRiders = await Rider.find({
      isAvailable: true,
      isActive: true,
      currentLocation: { $exists: true }
    });

    return fallbackRiders
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

  for (const rider of riders) {
    const success = await tryAssignRider(order, rider);

    if (success) {
      global.io?.to(`order_${order._id}`).emit("rider_assigned", {
        riderId: rider._id,
        orderId: order._id
      });

      return rider;
    }
  }

  return exports.assignRiderToOrder(orderId);
};