const axios = require('axios');
const { getSetting } = require('../database');

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_GROUP = process.env.LINE_GROUP_CHAT_ID;

async function sendLINE(message) {
  if (!LINE_TOKEN || !LINE_GROUP) {
    console.log('[LINE] ไม่ได้ตั้งค่า token — ข้ามการส่ง');
    return false;
  }
  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: LINE_GROUP,
      messages: [{ type: 'text', text: message }]
    }, {
      headers: { 'Authorization': `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log('[LINE] ส่งสำเร็จ');
    return true;
  } catch (err) {
    console.error('[LINE] ส่งไม่สำเร็จ:', err.message);
    return false;
  }
}

async function sendTelegram(message) {
  const TG_TOKEN = getSetting('TELEGRAM_BOT_TOKEN');
  const TG_GROUP = getSetting('TELEGRAM_GROUP_CHAT_ID');
  if (!TG_TOKEN || !TG_GROUP) {
    const err = new Error('ยังไม่ได้ตั้งค่า Telegram (Bot Token / Chat ID) — ไปที่หน้าแอดมิน');
    console.log('[Telegram] ยังไม่ได้ตั้งค่า — ข้ามการส่ง');
    throw err;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: TG_GROUP,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log('[Telegram] ส่งสำเร็จ');
    return true;
  } catch (err) {
    console.error('[Telegram] ส่งไม่สำเร็จ:', err.response && err.response.data ? JSON.stringify(err.response.data) : err.message);
    throw new Error(`Telegram ส่งไม่สำเร็จ: ${err.response && err.response.data ? JSON.stringify(err.response.data) : err.message}`);
  }
}

async function sendTelegramBackup(fileBuffer) {
  const TG_TOKEN = getSetting('TELEGRAM_BOT_TOKEN');
  const TG_GROUP = getSetting('TELEGRAM_GROUP_CHAT_ID');
  if (!TG_TOKEN || !TG_GROUP) {
    console.log('[Telegram-สำรอง] ยังไม่ได้ตั้งค่า — ข้ามการสำรอง');
    return false;
  }
  try {
    const fd = new FormData();
    fd.append('chat_id', TG_GROUP);
    fd.append('caption', `💾 สำรองฐานข้อมูล HelpdeskPro\n⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
    fd.append('document', new Blob([fileBuffer], { type: 'application/octet-stream' }), `backup-${new Date().toISOString().slice(0, 10)}.db`);
    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendDocument`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    console.log('[Telegram-สำรอง] ส่งไฟล์สำเร็จ');
    return true;
  } catch (err) {
    console.error('[Telegram-สำรอง] ส่งไม่สำเร็จ:', err.response && err.response.data ? JSON.stringify(err.response.data) : err.message);
    return false;
  }
}

async function notifyNewTicket(ticket) {
  const priorityEmoji = {
    'ด่วนมาก': '🔴 ด่วนมาก',
    'ด่วน': '🟡 ด่วน',
    'ปกติ': '🟢 ปกติ'
  };

  const msg = [
    `🔧 แจ้งซ่อมใหม่ #${ticket.ticket_no}`,
    `━━━━━━━━━━━━━━━━━━`,
    `👤 ผู้แจ้ง: ${ticket.reporter_name}`,
    `📍 สถานที่: ${ticket.location}`,
    `📂 หมวดหมู่: ${ticket.category}`,
    `⚠️ ความสำคัญ: ${priorityEmoji[ticket.priority] || ticket.priority}`,
    `📝 ปัญหา: ${ticket.title}`,
    ticket.asset_id && ticket.asset_id !== '-' ? `🏷️ ทรัพย์สิน: ${ticket.asset_id}` : '',
    `━━━━━━━━━━━━━━━━━━`,
    `⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
  ].filter(Boolean).join('\n');

  await Promise.allSettled([sendLINE(msg), sendTelegram(msg)]);
}

async function notifyStatusUpdate(ticket, oldStatus) {
  const statusEmoji = {
    'รอดำเนินการ': '⏳', 'กำลังซ่อม': '🔧', 'รออะไหล่': '📦',
    'ส่งซ่อมภายนอก': '📤', 'เสร็จสิ้น': '✅'
  };

  const msg = [
    `📋 อัปเดตสถานะ #${ticket.ticket_no}`,
    `━━━━━━━━━━━━━━━━━━`,
    `${statusEmoji[oldStatus] || '❓'} ${oldStatus} → ${statusEmoji[ticket.status] || '❓'} ${ticket.status}`,
    ticket.technician && ticket.technician !== '-' ? `👨‍🔧 ช่าง: ${ticket.technician}` : '',
    ticket.cost > 0 ? `💰 ค่าใช้จ่าย: ฿${Number(ticket.cost).toLocaleString()}` : '',
    `📝 ${ticket.title}`,
    `━━━━━━━━━━━━━━━━━━`,
    `⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
  ].filter(Boolean).join('\n');

  await Promise.allSettled([sendLINE(msg), sendTelegram(msg)]);
}

async function sendDailyReport(data) {
  const now = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  const msg = [
    `📊 สรุปงานแจ้งซ่อมประจำวัน ${now}`,
    `━━━━━━━━━━━━━━━━━━`,
    `🆕 งานใหม่วันนี้: ${data.newToday} รายการ`,
    `⏳ รอดำเนินการ: ${data.pending} รายการ`,
    `🔧 กำลังดำเนินการ: ${data.doing} รายการ`,
    `📦 รออะไหล่: ${data.waitingParts} รายการ`,
    `📤 ส่งซ่อมภายนอก: ${data.outsourced} รายการ`,
    `✅ เสร็จสิ้นวันนี้: ${data.doneToday} รายการ`,
    `━━━━━━━━━━━━━━━━━━`,
    `💰 ค่าใช้จ่ายสะสมเดือนนี้: ฿${Number(data.monthCost).toLocaleString()}`,
    `⏰ อัปเดตอัตโนมัติ 09:00 น.`
  ].join('\n');

  await Promise.allSettled([sendLINE(msg), sendTelegram(msg)]);
}

async function sendWeeklyReport(data) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekStr = `${weekStart.toLocaleDateString('th-TH')} - ${now.toLocaleDateString('th-TH')}`;

  const msg = [
    `📋 รายงานประจำสัปดาห์`,
    `📆 สัปดาห์: ${weekStr}`,
    `━━━━━━━━━━━━━━━━━━`,
    `📥 งานใหม่ทั้งสัปดาห์: ${data.weekNew} รายการ`,
    `✅ เสร็จสิ้น: ${data.weekDone} รายการ`,
    `⏳ ค้าง: ${data.pending} รายการ`,
    `📦 รออะไหล่: ${data.waitingParts} รายการ`,
    `📤 ส่งซ่อมภายนอก: ${data.outsourced} รายการ`,
    `━━━━━━━━━━━━━━━━━━`,
    `💰 ค่าใช้จ่ายรวมสัปดาห์: ฿${Number(data.weekCost).toLocaleString()}`,
    `📈 เฉลี่ย/งาน: ฿${data.weekDone > 0 ? Math.round(data.weekCost / data.weekDone).toLocaleString() : 0}`,
    data.topTech ? `🏆 ช่างทำงานมากสุด: ${data.topTech} (${data.topTechCount} งาน)` : '',
    data.overdue > 0 ? `🔴 งานค้าง >3 วัน: ${data.overdue} รายการ` : '',
    `━━━━━━━━━━━━━━━━━━`,
    `⏰ รายงานอัตโนมัติ 16:00 น. วันศุกร์`
  ].filter(Boolean).join('\n');

  await Promise.allSettled([sendLINE(msg), sendTelegram(msg)]);
}

module.exports = {
  sendLINE, sendTelegram, sendTelegramBackup,
  notifyNewTicket, notifyStatusUpdate,
  sendDailyReport, sendWeeklyReport
};
