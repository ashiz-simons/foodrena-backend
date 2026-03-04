const Rider = require("../models/Rider");
const Order = require("../models/Order");
const redis = require("./redis");

async function autoAssignRider(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return;

  // Find first available rider (MVP)
  const rider = await Rider.findOne({ status: "available" });

  if (!rider) {
    console.log("No riders available");
    return;
  }

  // Assign rider
  order.rider = rider._id;
  order.status = "rider_assigned";
  await order.save();

  // Mark rider busy
  rider.status = "busy";
  await rider.save();

  // Notify rider in realtime
  if (redis) {
    await redis.publish(
      "rider.assigned",
      JSON.stringify({
        riderId: rider._id,
        orderId: order._id,
      })
    );
  }

  console.log("Rider auto-assigned:", rider._id);
}

module.exports = autoAssignRider;