exports.expireAssignment = async (orderId) => {
  const order = await Order.findById(orderId);

  if (!order || order.status !== "rider_assigned") return;

  order.rider = null;
  order.status = "searching_rider";
  await order.save();

  const { assignRiderToOrder } = require("./riderMatching");
  await assignRiderToOrder(orderId);
};
