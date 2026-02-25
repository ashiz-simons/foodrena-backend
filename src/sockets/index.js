const riderSocket = require("./rider.socket");
const orderSocket = require("./order.socket");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("⚡ Client connected:", socket.id);

    riderSocket(io, socket);
    orderSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });
};
