const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { createUpload } = require('../services/upload');

const router = express.Router();

const upload = createUpload({ prefix: 'ticket', maxFiles: 5 });

// POST /api/upload — รองรับหลายรูป (สูงสุด 5), field name = 'photos'
router.post('/', authMiddleware, upload.array('photos', 5), (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ status: 'error', message: 'ไม่พบไฟล์' });
  }
  const urls = req.files.map(f => `/uploads/${f.filename}`);
  res.json({ status: 'success', url: urls[0], urls });
});

module.exports = router;
