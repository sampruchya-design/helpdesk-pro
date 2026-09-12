const express = require('express');
const { getSetting, setSetting } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { safeJsonParse } = require('../services/utils');

const router = express.Router();

// GET /api/settings (admin only) — ค่าแสดง: env ก่อน (ค้างถาวร), แล้ว DB
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const refCost = safeJsonParse(getSetting('REF_COST_PRICE') || '{}', {});
  const tgToken = process.env.TELEGRAM_BOT_TOKEN || getSetting('TELEGRAM_BOT_TOKEN') || '';
  const tgChat = process.env.TELEGRAM_GROUP_CHAT_ID || getSetting('TELEGRAM_GROUP_CHAT_ID') || '';
  res.json({
    status: 'success',
    settings: {
      TELEGRAM_BOT_TOKEN: tgToken,
      TELEGRAM_GROUP_CHAT_ID: tgChat,
      TELEGRAM_SOURCE: process.env.TELEGRAM_BOT_TOKEN ? 'env (ถาวรผ่าน Render)' : (getSetting('TELEGRAM_BOT_TOKEN') ? 'database' : ''),
      LINE_NOTIFY_GROUP_ID: getSetting('LINE_NOTIFY_GROUP_ID') || '',
      REF_COST_PRICE: refCost
    }
  });
});

// PUT /api/settings (admin only) — ถ้าค่าเท่ากับ env → ไม่ต้องทับ; ต่างจาก env → กัน env ถูกล้าง
router.put('/', authMiddleware, adminOnly, (req, res) => {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID, REF_COST_PRICE } = req.body;
  if (TELEGRAM_BOT_TOKEN !== undefined) {
    const envT = process.env.TELEGRAM_BOT_TOKEN || '';
    setSetting('TELEGRAM_BOT_TOKEN', (TELEGRAM_BOT_TOKEN || '').trim());
    if (TELEGRAM_BOT_TOKEN && envT && TELEGRAM_BOT_TOKEN.trim() !== envT) {
      console.log('[Settings] Telegram env ต่างจากค่าที่บันทึก — ใช้ env (ถาวร) ที่ตั้งไว้ใน Render');
    }
  }
  if (TELEGRAM_GROUP_CHAT_ID !== undefined) setSetting('TELEGRAM_GROUP_CHAT_ID', String(TELEGRAM_GROUP_CHAT_ID).trim());
  if (REF_COST_PRICE !== undefined) setSetting('REF_COST_PRICE', JSON.stringify(REF_COST_PRICE || {}));
  res.json({ status: 'success', message: 'บันทึกการตั้งค่าแล้ว' });
});

// POST /api/settings/telegram-test (admin only)
router.post('/telegram-test', authMiddleware, adminOnly, async (req, res) => {
  const { sendTelegram } = require('../services/notification');
  try {
    await sendTelegram('✅ ทดสอบการแจ้งเตือนจาก HelpdeskPro — ระบบพร้อมใช้งานแล้ว');
    res.json({ status: 'success', message: '✅ ส่งสำเร็จ — เช็ค Telegram ได้เลย' });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/settings/report-daily — ส่งสรุปรายวัน (admin only)
router.post('/report-daily', authMiddleware, adminOnly, async (req, res) => {
  const { generateDailyReport } = require('../services/scheduler');
  try {
    await generateDailyReport();
    res.json({ status: 'success', message: '✅ ส่งสรุปรายวันแล้ว — เช็ค LINE/Telegram' });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// POST /api/settings/report-weekly — ส่งสรุปรายสัปดาห์ (admin only)
router.post('/report-weekly', authMiddleware, adminOnly, async (req, res) => {
  const { generateWeeklyReport } = require('../services/scheduler');
  try {
    await generateWeeklyReport();
    res.json({ status: 'success', message: '✅ ส่งสรุปรายสัปดาห์แล้ว — เช็ค LINE/Telegram' });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

module.exports = router;