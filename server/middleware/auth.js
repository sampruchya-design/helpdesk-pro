const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { getOne } = require('../database');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'ไม่มี token กรุณาเข้าสู่ระบบ' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // BUG-1: re-check user ใน DB ทุกครั้ง — กัน user ถูกลบ/ปิดการใช้งานแล้วยังเข้าถึง API ได้
    const user = getOne('SELECT id, code, name, role, position, active FROM users WHERE id = ?', [decoded.id]);
    if (!user || user.active !== 1) {
      return res.status(401).json({ status: 'error', message: 'Token หมดอายุหรือไม่ถูกต้อง' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ status: 'error', message: 'Token หมดอายุหรือไม่ถูกต้อง' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ status: 'error', message: 'ต้องเป็นผู้ดูแลระบบเท่านั้น' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
