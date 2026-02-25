module.exports = (io, socket) => {
  socket.on("join_order_room", ({ orderId }) => {
    socket.join(`order_${orderId}`);
  });
};
