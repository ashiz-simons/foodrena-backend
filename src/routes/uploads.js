const express = require("express");
const router = express.Router();
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// storage engine
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "foodrena",
      format: file.mimetype.split("/")[1], // jpg, png, etc
      public_id: `${Date.now()}`,
    };
  },
});

// multer middleware
const upload = multer({ storage });

// Single upload route
router.post("/single", upload.single("file"), (req, res) => {
  return res.json({
    message: "Upload successful",
    url: req.file.path,          // Cloudinary URL
    public_id: req.file.filename // Cloudinary file id
  });
});

// Multi-file upload
router.post("/multiple", upload.array("files", 10), (req, res) => {
  const uploaded = req.files.map((f) => ({
    url: f.path,
    public_id: f.filename,
  }));

  return res.json({
    message: "Files uploaded",
    files: uploaded,
  });
});

module.exports = router;
