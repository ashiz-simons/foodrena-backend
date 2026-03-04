const cloudinary = require('cloudinary').v2;

console.log("🌥 CLOUD NAME:", process.env.CLOUD_NAME);
console.log("🔑 API KEY:", process.env.CLOUD_API_KEY ? "Loaded" : "Missing");
console.log("🔐 API SECRET:", process.env.CLOUD_API_SECRET ? "Loaded" : "Missing");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

module.exports = cloudinary;