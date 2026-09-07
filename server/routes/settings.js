const express = require('express');
const { getSetting, setSetting } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings (admin only)
router.get('/', authMiddleware, adminOnly, (req, res) => {
  res.json({
    status: 'success',
    settings: {
      TELEGRAM_BOT_TOKEN: getSetting('TELEGRAM_BOT_TOKEN') || '',
      TELEGRAM_GROUP_CHAT_ID: getSetting('TELEGRAM_GROUP_CHAT_ID') || ''
    }
  });
});

// PUT /api/settings (admin only)
router.put('/', authMiddleware, adminOnly, (req, res) => {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID } = req.body;
  if (TELEGRAM_BOT_TOKEN !== undefined) setSetting('TELEGRAM_BOT_TOKEN', String(TELEGRAM_BOT_TOKEN).trim());
  if (TELEGRAM_GROUP_CHAT_ID !== undefined) setSetting('TELEGRAM_GROUP_CHAT_ID', String(TELEGRAM_GROUP_CHAT_ID).trim());
  res.json({ status: 'success', message: 'บันทึกการตั้งค่า Telegram แล้ว' });
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

module.exports = router;