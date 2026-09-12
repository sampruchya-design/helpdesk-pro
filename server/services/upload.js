// ==========================================
//  UPLOAD — ตั้งค่า multer กลาง (ใช้ซ้ำที่ tickets/KM/upload)
// ==========================================
const multer = require('multer');
const path = require('path');

function createUpload({ prefix, maxFiles = 5 }) {
  const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${prefix}_${Date.now()}${ext}`);
    }
  });
  const allowed = /jpeg|jpg|png|gif|webp|pdf/;
  return multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024, files: maxFiles }, // 25MB/ไฟล์
    fileFilter: (req, file, cb) => {
      const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
      const mimeOk = allowed.test(file.mimetype);
      if (extOk && mimeOk) cb(null, true);
      else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp) หรือ PDF'));
    }
  });
}

module.exports = { createUpload };