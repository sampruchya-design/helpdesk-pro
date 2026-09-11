require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDB, getAll, getOne, runQuery, saveDB, getSetting } = require('./database');
const { authMiddleware, adminOnly } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);

app.use(cors());
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/line', require('./routes/line'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/kms', require('./routes/kms'));
// DEBUG: ดูสถานะ env vars (ไม่เปิดเผยค่า secret — ตอบแค่ true/false)
app.get('/api/debug/env', (req, res) => {
  res.json({
    lineToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    lineChannelId: Boolean(process.env.LINE_CHANNEL_ID),
    lineChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
    lineGroup: Boolean(process.env.LINE_GROUP_CHAT_ID),
    lineDetectedGroup: getSetting('LINE_NOTIFY_GROUP_ID') || null,
    jwtSet: Boolean(process.env.JWT_SECRET),
    port: process.env.PORT || '(default 3000)'
  });
});

app.use('/api/settings', require('./routes/settings'));

// === Backup (admin) ===
app.get('/api/backup', authMiddleware, adminOnly, (req, res) => {
  try {
    saveDB();
    const file = path.join(__dirname, 'data', 'database.db');
    if (!fs.existsSync(file)) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบไฟล์ฐานข้อมูล' });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.download(file, `helpdeskpro-backup-${stamp}.db`);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// === Config: Categories ===
app.get('/api/config/categories', authMiddleware, (req, res) => {
  const rows = getAll('SELECT * FROM categories ORDER BY id');
  res.json({ status: 'success', categories: rows });
});

app.post('/api/config/categories', authMiddleware, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'กรุณากรอกชื่อหมวดหมู่' });
  try {
    runQuery('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
    res.json({ status: 'success', message: 'เพิ่มสำเร็จ' });
  } catch (e) {
    res.status(409).json({ status: 'error', message: 'ชื่อนี้มีอยู่แล้ว' });
  }
});

app.delete('/api/config/categories/:id', authMiddleware, adminOnly, (req, res) => {
  runQuery('DELETE FROM categories WHERE id = ?', [Number(req.params.id)]);
  res.json({ status: 'success' });
});

// === Config: Locations ===
app.get('/api/config/locations', authMiddleware, (req, res) => {
  const rows = getAll('SELECT * FROM locations ORDER BY id');
  res.json({ status: 'success', locations: rows });
});

app.post('/api/config/locations', authMiddleware, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'กรุณากรอกชื่อสถานที่' });
  try {
    runQuery('INSERT INTO locations (name) VALUES (?)', [name.trim()]);
    res.json({ status: 'success', message: 'เพิ่มสำเร็จ' });
  } catch (e) {
    res.status(409).json({ status: 'error', message: 'ชื่อนี้มีอยู่แล้ว' });
  }
});

app.delete('/api/config/locations/:id', authMiddleware, adminOnly, (req, res) => {
  runQuery('DELETE FROM locations WHERE id = ?', [Number(req.params.id)]);
  res.json({ status: 'success' });
});

// === Config: Technicians ===
app.get('/api/config/technicians', authMiddleware, (req, res) => {
  const rows = getAll('SELECT * FROM technicians ORDER BY name');
  res.json({ status: 'success', technicians: rows });
});

app.post('/api/config/technicians', authMiddleware, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ status: 'error', message: 'กรุณากรอกชื่อช่าง' });
  try {
    runQuery('INSERT INTO technicians (name) VALUES (?)', [name.trim()]);
    res.json({ status: 'success', message: 'เพิ่มสำเร็จ' });
  } catch (e) {
    res.status(409).json({ status: 'error', message: 'ชื่อนี้มีอยู่แล้ว' });
  }
});

app.delete('/api/config/technicians/:id', authMiddleware, adminOnly, (req, res) => {
  runQuery('DELETE FROM technicians WHERE id = ?', [Number(req.params.id)]);
  res.json({ status: 'success' });
});

// === Export ===
app.get('/api/export/:format', authMiddleware, (req, res) => {
  const format = req.params.format;
  const tickets = getAll('SELECT * FROM tickets ORDER BY created_at DESC');

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets_export.json');
    res.json(tickets);
  } else if (format === 'csv') {
    const header = 'วันที่,เลขที่,สถานที่,รหัสทรัพย์สิน,หมวดหมู่,ผู้แจ้ง,ปัญหา,สถานะ,ช่าง,ค่าใช้จ่าย\n';
    const rows = tickets.map(r =>
      `"${r.created_at}","${r.ticket_no}","${r.location}","${r.asset_id || ''}","${r.category}","${r.reporter_name}","${r.title}","${r.status}","${r.technician || ''}",${r.cost || 0}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets_export.csv');
    res.send('\uFEFF' + header + rows);
  } else {
    const lines = tickets.map(r =>
      `[${r.created_at}] ${r.ticket_no} | ${r.location} | ทรัพย์สิน: ${r.asset_id || '-'} | ผู้แจ้ง: ${r.reporter_name} | อาการ: ${r.title} | สถานะ: ${r.status} | ค่าใช้จ่าย: ฿${r.cost || 0}`
    );
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets_export.txt');
    res.send(lines.join('\n'));
  }
});

// === Socket.IO ===
io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socket.id);
  });
});

// Catch-all
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
  }
});

// Start
const PORT = process.env.PORT || 3000;

(async () => {
  await getDB();
  console.log('✅ SQLite database พร้อมแล้ว');

  const { startScheduler } = require('./services/scheduler');
  startScheduler(saveDB);

  server.listen(PORT, () => {
    console.log(`\n🔧 HelpdeskPro Server ทำงานที่ port ${PORT}`);
    console.log(`📡 WebSocket: เปิดใช้งาน`);
    console.log(`⏰ Scheduler: Daily 09:00 + Weekly Fri 16:00`);
    console.log(`🌐 http://localhost:${PORT}\n`);
  });
})();
