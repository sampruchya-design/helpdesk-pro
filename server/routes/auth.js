const express = require('express');
const jwt = require('jsonwebtoken');
const { getOne, runQuery, getAll, hashPin, verifyPin } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { JWT_SECRET } = require('../config');

const router = express.Router();

// Rate limit: กัน brute-force รหัสผ่าน (5 ครั้งผิด / 10 นาที ต่อ code+IP)
const loginFails = new Map(); // key `code:ip` → { count, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

function loginKey(code, ip) { return `${String(code).toLowerCase()}:${ip}`; }

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { code, pin } = req.body;
  const ip = getIP(req);

  if (!code || !String(code).trim()) {
    return res.status(400).json({ status: 'error', message: 'กรุณากรอกรหัสพนักงาน' });
  }

  // เช็ค lockout ก่อน
  const rec = loginFails.get(loginKey(code, ip));
  if (rec && rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const left = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ status: 'error', message: `ลองใหม่ได้ในอีก ${left} นาที (รหัสผ่านผิดบ่อยเกินไป)` });
  }

  const user = getOne('SELECT * FROM users WHERE lower(trim(code)) = lower(?) AND active = 1', [String(code).trim()]);

  if (!user || !verifyPin(pin || '', user.pin || '')) {
    // นับความล้มเหลว
    const key = loginKey(code, ip);
    const r = loginFails.get(key) || { count: 0 };
    r.count += 1;
    if (r.count >= MAX_LOGIN_ATTEMPTS) { r.lockedUntil = Date.now() + LOCK_MS; r.count = 0; }
    loginFails.set(key, r);
    // กัน leak ว่า user มีจริง → ข้อความเดียวกันทั้งสองกรณี
    return res.status(401).json({ status: 'error', message: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' });
  }

  // สำเร็จ → เคลียร์ fail counter + อัปเกรด PIN legacy (SHA-256) เป็น scrypt
  loginFails.delete(loginKey(code, ip));
  const stored = user.pin || '';
  if (stored && !stored.startsWith('scrypt$')) {
    try { runQuery('UPDATE users SET pin = ? WHERE id = ?', [hashPin(String(pin)), user.id]); } catch (e) {}
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, code: user.code },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    status: 'success',
    token,
    user: { id: user.id, code: user.code, name: user.name, role: user.role, position: user.position || null }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = getOne('SELECT id, code, name, role, position FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้' });
  res.json({ status: 'success', user });
});

// POST /api/auth/register (admin only)
router.post('/register', authMiddleware, adminOnly, (req, res) => {
  const { code, name, role, position, pin } = req.body;
  if (!code || !String(code).trim() || !name || !String(name).trim()) {
    return res.status(400).json({ status: 'error', message: 'กรุณากรอกรหัสพนักงานและชื่อ' });
  }

  const newCode = String(code).trim();
  const existing = getOne('SELECT id FROM users WHERE lower(code) = lower(?)', [newCode]);
  if (existing) {
    return res.status(409).json({ status: 'error', message: 'รหัสพนักงานนี้ถูกใช้แล้ว' });
  }

  const newName = String(name).trim();
  const finalPin = pin && String(pin).trim() ? String(pin).trim() : newCode; // ไม่กรอก = ใช้รหัสพนักงาน
  runQuery('INSERT INTO users (code, name, role, position, pin) VALUES (?, ?, ?, ?, ?)',
    [newCode, newName, role === 'admin' ? 'admin' : 'user', (position && String(position).trim()) || null, hashPin(finalPin)]);

  const newUser = getOne('SELECT id, code, name, role, position FROM users ORDER BY id DESC LIMIT 1');
  res.json({ status: 'success', user: newUser });
});

// GET /api/auth/users (admin only)
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = getAll(`
    SELECT id, code, name, role, position, active, created_at,
      CASE WHEN pin IS NOT NULL AND pin != '' THEN 1 ELSE 0 END as pin_set
    FROM users ORDER BY id
  `);
  res.json({ status: 'success', users });
});

// PUT /api/auth/users/:id (admin only)
router.put('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { code, name, role, position, pin, active } = req.body;
  const user = getOne('SELECT * FROM users WHERE id = ?', [Number(req.params.id)]);
  if (!user) return res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้' });

  let updates = [];
  let params = [];

  if (code !== undefined && String(code).trim()) {
    const newCode = String(code).trim();
    const dup = getOne('SELECT id FROM users WHERE lower(code) = lower(?) AND id != ?', [newCode, user.id]);
    if (dup) {
      return res.status(409).json({ status: 'error', message: 'รหัสพนักงานนี้ถูกใช้แล้ว' });
    }
    updates.push('code = ?');
    params.push(newCode);
  }
  if (name !== undefined && String(name).trim()) { updates.push('name = ?'); params.push(String(name).trim()); }
  if (role) { updates.push('role = ?'); params.push(role); }
  if (position !== undefined) { updates.push('position = ?'); params.push(position && String(position).trim() ? String(position).trim() : null); }
  if (pin !== undefined && String(pin).trim()) { updates.push('pin = ?'); params.push(hashPin(String(pin).trim())); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

  if (updates.length === 0) {
    return res.status(400).json({ status: 'error', message: 'ไม่มีข้อมูลที่ต้องแก้ไข' });
  }

  params.push(Number(req.params.id));
  runQuery(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ status: 'success', message: 'อัปเดตสำเร็จ' });
});

// DELETE /api/auth/users/:id (admin only)
router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const user = getOne('SELECT * FROM users WHERE id = ?', [Number(req.params.id)]);
  if (!user) return res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้' });
  if (user.role === 'admin') {
    return res.status(400).json({ status: 'error', message: 'ไม่ลบแอดมินได้' });
  }
  runQuery('DELETE FROM users WHERE id = ?', [Number(req.params.id)]);
  res.json({ status: 'success', message: 'ลบผู้ใช้สำเร็จ' });
});

module.exports = router;