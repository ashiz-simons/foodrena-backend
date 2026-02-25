let io;

module.exports = {
  init: (serverIo) => {
    io = serverIo;
  },
  emit: (...args) => {
    if (io) io.emit(...args);
  }
};
