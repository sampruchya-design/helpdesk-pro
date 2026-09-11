const express = require('express');
const { getSetting, setSetting } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings (admin only)
router.get('/', authMiddleware, adminOnly, (req, res) => {
  let refCost = {};
  try { refCost = JSON.parse(getSetting('REF_COST_PRICE') || '{}'); } catch {}
  res.json({
    status: 'success',
    settings: {
      TELEGRAM_BOT_TOKEN: getSetting('TELEGRAM_BOT_TOKEN') || '',
      TELEGRAM_GROUP_CHAT_ID: getSetting('TELEGRAM_GROUP_CHAT_ID') || '',
      LINE_NOTIFY_GROUP_ID: getSetting('LINE_NOTIFY_GROUP_ID') || '',
      REF_COST_PRICE: refCost
    }
  });
});

// PUT /api/settings (admin only)
router.put('/', authMiddleware, adminOnly, (req, res) => {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID, REF_COST_PRICE } = req.body;
  if (TELEGRAM_BOT_TOKEN !== undefined) setSetting('TELEGRAM_BOT_TOKEN', String(TELEGRAM_BOT_TOKEN).trim());
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