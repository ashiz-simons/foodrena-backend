const express = require('express');
const router = express.Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/upload
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Optional folder passed from frontend
    const folder = req.body.folder || "general";

    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `foodrena/${folder}`,
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );

        streamifier
          .createReadStream(req.file.buffer)
          .pipe(stream);
      });
    };

    const result = await streamUpload();

    res.status(200).json({
      url: result.secure_url,
      publicId: result.public_id,
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

module.exports = router;