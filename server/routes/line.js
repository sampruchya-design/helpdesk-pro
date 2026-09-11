const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { setSetting } = require('../database');
const router = express.Router();

const IDS_FILE = path.join(__dirname, '..', 'data', 'line_ids.json');
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

let webhookStats = { hits: 0, valid: 0, lastTime: null };

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

async function replyLine(replyToken, text) {
  if (!LINE_TOKEN || !replyToken) return;
  try {
    await axios.post('https://api.line.me/v2/bot/message/reply', {
      replyToken,
      messages: [{ type: 'text', text }]
    }, {
      headers: { 'Authorization': `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[LINE] ส่งข้อความตอบกลับไม่สำเร็จ:', e.message);
  }
}

router.post('/webhook', (req, res) => {
  webhookStats.hits += 1;
  webhookStats.lastTime = new Date().toISOString();

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
  webhookStats.valid += 1;

  const events = req.body && req.body.events ? req.body.events : [];
  const ids = readIds();

  for (const ev of events) {
    const src = ev.source || {};

    if (src.groupId) {
      const isNew = !ids.groupId || ids.groupId !== src.groupId;
      ids.groupId = src.groupId;
      console.log('[LINE] ⛳ จับกลุ่มได้:', src.groupId);
      // บันทึกเป็นกลุ่มเป้าหมายแจ้งเตือน (ให้แจ้งเตือนตามไปที่กลุ่มนี้) — เฉพาะเมื่อกลุ่มเปลี่ยน
      if (isNew) {
        try { setSetting('LINE_NOTIFY_GROUP_ID', src.groupId); } catch (e) {}
        if (ev.type === 'join' || ev.type === 'memberJoined') {
          console.log('[LINE] 🎉 บอทถูกเพิ่มเข้ากลุ่ม — ตั้งเป็นกลุ่มแจ้งเตือนแล้ว');
          replyLine(ev.replyToken, '✅ ตั้งกลุ่มนี้เป็นกลุ่มรับแจ้งเตือน HelpdeskPro แล้ว!\nจากนี้ การแจ้งซ่อม/อัปเดต/สรุปรายงาน จะส่งมาที่กลุ่มนี้');
        }
      }
    } else if (src.roomId) {
      // กลุ่มของบุคคลที่ใช้ LINE (roomId) — เก็บไว้เฉยๆ
      if (!ids.roomId || ids.roomId !== src.roomId) {
        ids.roomId = src.roomId;
        console.log('[LINE] ⛳ จับ roomId ได้:', src.roomId);
        try { setSetting('LINE_NOTIFY_GROUP_ID', src.roomId); } catch (e) {}
      }
    }

    if (src.userId && src.userId !== ids.userId) {
      ids.userId = src.userId;
      console.log('[LINE] ⛳ จับ userId ได้:', src.userId);
    }
  }

  if (events.length) {
    saveIds(ids);
    console.log('[LINE] webhook รับ event:', events.map(e => e.type).join(', '));
    console.log('[LINE] 👉 กลุ่มเป้าหมายแจ้งเตือน =', ids.groupId || '(ยังไม่มี — เพิ่ม bot เข้ากลุ่มก่อน)');
  }

  res.json({});
});

router.get('/ids', (req, res) => {
  res.json({ status: 'success', ...readIds(), webhookStats });
});

module.exports = router;