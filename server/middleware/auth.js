const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'ไม่มี token กรุณาเข้าสู่ระบบ' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
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
