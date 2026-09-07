const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

const IDS_FILE = path.join(__dirname, '..', 'data', 'line_ids.json');
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

function readIds() {
  try {
    return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveIds(ids) {
  fs.mkdirSync(path.dirname(IDS_FILE), { recursive: true });
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));
}

router.post('/webhook', (req, res) => {
  if (CHANNEL_SECRET) {
    const signature = req.headers['x-line-signature'] || '';
    const expected = crypto
      .createHmac('sha256', CHANNEL_SECRET)
      .update(req.rawBody || '')
      .digest('base64');
    if (signature !== expected) {
      console.warn('[LINE] ลายเซ็น webhook ไม่ตรง — ปฏิเสธ');
      return res.status(401).end();
    }
  }

  const events = req.body && req.body.events ? req.body.events : [];
  const ids = readIds();

  for (const ev of events) {
    const src = ev.source || {};
    if (src.groupId && src.groupId !== ids.groupId) {
      ids.groupId = src.groupId;
      console.log('[LINE] ⛳ จับ groupId ได้:', src.groupId);
    }
    if (src.roomId && src.roomId !== ids.roomId) {
      ids.roomId = src.roomId;
      console.log('[LINE] ⛳ จับ roomId ได้:', src.roomId);
    }
    if (src.userId && src.userId !== ids.userId) {
      ids.userId = src.userId;
      console.log('[LINE] ⛳ จับ userId ได้:', src.userId);
    }
  }

  if (events.length) {
    saveIds(ids);
    console.log('[LINE] webhook รับ event:', events.map(e => e.type).join(', '));
    console.log('[LINE] 👉 ค่า LINE_GROUP_CHAT_ID =', ids.groupId || '(ยังไม่มี — เพิ่ม bot เข้ากลุ่มก่อน)');
    console.log('[LINE] บันทึกเข้าร้านไฟล์ data/line_ids.json แล้ว');
  }

  res.json({});
});

router.get('/ids', (req, res) => {
  res.json({ status: 'success', ...readIds() });
});

module.exports = router;