const https = require("https");

const BACKEND_URL = "https://foodrena-backend-1.onrender.com/api/health";
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function keepAlive() {
  https.get(BACKEND_URL, (res) => {
    console.log(`✅ Keep-alive ping: ${res.statusCode}`);
  }).on("error", (err) => {
    console.error("❌ Keep-alive ping failed:", err.message);
  });
}

module.exports = function startKeepAlive() {
  console.log("🏓 Keep-alive started — pinging every 10 minutes");
  keepAlive(); // ping immediately on start
  setInterval(keepAlive, INTERVAL_MS);
};