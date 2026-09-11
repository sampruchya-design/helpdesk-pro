const express = require('express');
const multer = require('multer');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ticket_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB/รูป, สูงสุด 5 รูป
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp)'));
  }
});

// POST /api/upload — รองรับหลายรูป (สูงสุด 5), field name = 'photos'
router.post('/', authMiddleware, upload.array('photos', 5), (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ status: 'error', message: 'ไม่พบไฟล์' });
  }
  const urls = req.files.map(f => `/uploads/${f.filename}`);
  res.json({ status: 'success', url: urls[0], urls });
});

module.exports = router;
