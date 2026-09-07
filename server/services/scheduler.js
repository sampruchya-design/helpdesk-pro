const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getAll, getOne } = require('../database');
const { sendDailyReport, sendWeeklyReport, sendTelegramBackup } = require('./notification');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.db');

function backupDatabaseToTelegram(saveDB) {
  try {
    saveDB();
    const buf = fs.readFileSync(DB_PATH);
    sendTelegramBackup(buf).then(ok => {
      console.log(ok ? '[Scheduler] ส่งสำรองข้อมูลไป Telegram แล้ว' : '[Scheduler] ข้ามสำรอง (ยังไม่ตั้งค่า Telegram)');
    });
  } catch (err) {
    console.error('[Scheduler] สำรองข้อมูลผิดพลาด:', err.message);
  }
}

function startScheduler(saveDB) {
  // สำรองข้อมูลอัตโนมัติ → Telegram: หลัง start 60 วินาที + ทุก 6 ชั่วโมง
  setTimeout(() => backupDatabaseToTelegram(saveDB), 60 * 1000);
  cron.schedule('0 */6 * * *', () => backupDatabaseToTelegram(saveDB), { timezone: 'Asia/Bangkok' });

  // Daily report — ทุกวัน 09:00
  cron.schedule('0 9 * * *', () => {
    console.log('[Scheduler] ส่ง Daily Report...');
    generateDailyReport();
  }, { timezone: 'Asia/Bangkok' });

  // Weekly report — ทุกวันศุกร์ 16:00
  cron.schedule('0 16 * * 5', () => {
    console.log('[Scheduler] ส่ง Weekly Report...');
    generateWeeklyReport();
  }, { timezone: 'Asia/Bangkok' });

  console.log('[Scheduler] เริ่มต้นแล้ว — สำรองทุก 6 ชม., Daily 09:00, Weekly Fri 16:00');
}

function generateDailyReport() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const newToday = getOne("SELECT COUNT(*) as c FROM tickets WHERE date(created_at) = ?", [today]);
  const pending = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'รอดำเนินการ'");
  const doing = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'กำลังซ่อม'");
  const waitingParts = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'รออะไหล่'");
  const outsourced = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'ส่งซ่อมภายนอก'");
  const doneToday = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'เสร็จสิ้น' AND date(updated_at) = ?", [today]);
  const monthCost = getOne("SELECT COALESCE(SUM(cost), 0) as c FROM tickets WHERE created_at >= ?", [monthStart]);

  sendDailyReport({
    newToday: newToday.c,
    pending: pending.c,
    doing: doing.c,
    waitingParts: waitingParts.c,
    outsourced: outsourced.c,
    doneToday: doneToday.c,
    monthCost: monthCost.c
  });
}

function generateWeeklyReport() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  const startStr = weekStart.toISOString().slice(0, 10);
  const endStr = now.toISOString().slice(0, 10);

  const weekNew = getOne("SELECT COUNT(*) as c FROM tickets WHERE date(created_at) BETWEEN ? AND ?", [startStr, endStr]);
  const weekDone = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'เสร็จสิ้น' AND date(updated_at) BETWEEN ? AND ?", [startStr, endStr]);
  const pending = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'รอดำเนินการ'");
  const waitingParts = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'รออะไหล่'");
  const outsourced = getOne("SELECT COUNT(*) as c FROM tickets WHERE status = 'ส่งซ่อมภายนอก'");
  const weekCost = getOne("SELECT COALESCE(SUM(cost), 0) as c FROM tickets WHERE date(created_at) BETWEEN ? AND ?", [startStr, endStr]);

  const topTechRow = getOne(`
    SELECT technician, COUNT(*) as c FROM tickets
    WHERE technician IS NOT NULL AND technician != '-'
    AND date(created_at) BETWEEN ? AND ?
    GROUP BY technician ORDER BY c DESC LIMIT 1
  `, [startStr, endStr]);

  const overdue = getOne(`
    SELECT COUNT(*) as c FROM tickets
    WHERE status IN ('รอดำเนินการ', 'กำลังซ่อม', 'รออะไหล่', 'ส่งซ่อมภายนอก')
    AND julianday('now','localtime') - julianday(created_at) > 3
  `);

  sendWeeklyReport({
    weekNew: weekNew.c,
    weekDone: weekDone.c,
    pending: pending.c,
    waitingParts: waitingParts.c,
    outsourced: outsourced.c,
    weekCost: weekCost.c,
    topTech: topTechRow?.technician || null,
    topTechCount: topTechRow?.c || 0,
    overdue: overdue.c
  });
}

module.exports = { startScheduler };
