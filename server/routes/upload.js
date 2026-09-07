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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp)'));
  }
});

// POST /api/upload
router.post('/', authMiddleware, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'ไม่พบไฟล์' });
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ status: 'success', url, filename: req.file.filename });
});

module.exports = router;
