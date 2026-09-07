const express = require('express');
const jwt = require('jsonwebtoken');
const { getOne, runQuery, getAll } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'helpdesk-pro-secret';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { code } = req.body;
  if (!code || !String(code).trim()) {
    return res.status(400).json({ status: 'error', message: 'กรุณากรอกรหัสพนักงาน' });
  }

  const user = getOne('SELECT * FROM users WHERE lower(trim(code)) = lower(?) AND active = 1', [String(code).trim()]);

  if (!user) {
    return res.status(401).json({ status: 'error', message: 'รหัสพนักงานไม่ถูกต้อง' });
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
  const { code, name, role } = req.body;
  if (!code || !String(code).trim() || !name || !String(name).trim()) {
    return res.status(400).json({ status: 'error', message: 'กรุณากรอกรหัสพนักงานและชื่อ' });
  }

  const newCode = String(code).trim();
  const existing = getOne('SELECT id FROM users WHERE lower(code) = lower(?)', [newCode]);
  if (existing) {
    return res.status(409).json({ status: 'error', message: 'รหัสพนักงานนี้ถูกใช้แล้ว' });
  }

  const newName = String(name).trim();
  runQuery('INSERT INTO users (code, name, role) VALUES (?, ?, ?)', [newCode, newName, role === 'admin' ? 'admin' : 'user']);

  const newUser = getOne('SELECT id, code, name, role FROM users ORDER BY id DESC LIMIT 1');
  res.json({ status: 'success', user: newUser });
});

// GET /api/auth/users (admin only)
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = getAll('SELECT id, code, name, role, active, created_at FROM users ORDER BY id');
  res.json({ status: 'success', users });
});

// PUT /api/auth/users/:id (admin only)
router.put('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { code, name, role, active } = req.body;
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