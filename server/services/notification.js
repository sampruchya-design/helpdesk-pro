const axios = require('axios');
const { getSetting } = require('../database');

const BASE_URL = process.env.RENDER_EXTERNAL_URL || 'https://helpdeskpro-48vl.onrender.com';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_MAX_ATTEMPTS = 3;
const LINE_RETRY_BASE_MS = 1000;
const LINE_RETRY_CAP_MS = 5000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function lineConfig() {
  return {
    token: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    fallback: process.env.LINE_GROUP_CHAT_ID || ''
  };
}

function resolveLineTarget(fallback) {
  try {
    const detected = getSetting('LINE_NOTIFY_GROUP_ID');
    if (detected) {
      if (detected !== fallback) console.log('[LINE] ใช้กลุ่มที่จับได้:', detected);
      return detected;
    }
  } catch (e) {}
  return fallback;
}

function describeLineError(err) {
  const status = err.response && err.response.status;
  const data = err.response && err.response.data;
  const parts = [];
  if (typeof data === 'string' && data) parts.push(data);
  else if (data && typeof data === 'object') {
    if (data.message) parts.push(data.message);
    if (Array.isArray(data.details)) data.details.forEach(d => { if (d && d.message) parts.push(d.message); });
  }
  return { status, reason: parts.join(' | ') || err.message || 'ไม่ทราบสาเหตุ' };
}

function lineHint(status) {
  if (status === 401) return 'token ไม่ถูกต้องหรือถูกยกเลิก — ต้องออกใหม่ที่ LINE Developers Console';
  if (status === 403) return 'บอทไม่ได้เป็นเพื่อนของผู้ใช้ หรือเข้ากลุ่มไม่ได้';
  if (status === 404) return 'ไม่พบปลายทาง — ตรวจ LINE_GROUP_CHAT_ID';
  if (status === 429) return 'โควต้ารายเดือนหมด หรือยิงถี่เกินลิมิต';
  return '';
}

function isRetryable(err) {
  const status = err.response && err.response.status;
  return status === undefined || status === 408 || status === 429 || (status >= 500 && status < 600);
}

function retryDelay(err, attempt) {
  const headers = (err.response && err.response.headers) || {};
  const header = headers['retry-after'] !== undefined ? headers['retry-after'] : headers['Retry-After'];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, LINE_RETRY_CAP_MS);
  return Math.min(LINE_RETRY_BASE_MS * Math.pow(2, attempt - 1), LINE_RETRY_CAP_MS);
}

// Telegram รองรับenv เพื่อให้รอดทุก deploy (Render เก็บ env ถาวร, DB ถูกล้างเมื่อ redeploy)
function tgConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || getSetting('TELEGRAM_BOT_TOKEN') || '',
    chat: process.env.TELEGRAM_GROUP_CHAT_ID || getSetting('TELEGRAM_GROUP_CHAT_ID') || ''
  };
}

function photoLinks(list, label) {
  list = (list || []).filter(Boolean).slice(0, 5);
  if (!list.length) return '';
  return `${label}:\n` + list.map(u => `• ${BASE_URL}${u}`).join('\n');
}

async function sendLINE(message) {
  const { token, fallback } = lineConfig();
  const target = resolveLineTarget(fallback);
  if (!token || !target) {
    console.log('[LINE] ไม่ได้ตั้งค่า token หรือปลายทาง — ข้ามการส่ง');
    return false;
  }
  for (let attempt = 1; attempt <= LINE_MAX_ATTEMPTS; attempt++) {
    try {
      await axios.post(LINE_PUSH_URL, {
        to: target,
        messages: [{ type: 'text', text: message }]
      }, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      console.log(attempt > 1 ? `[LINE] ส่งสำเร็จ (ลองใหม่ ${attempt - 1} ครั้ง)` : '[LINE] ส่งสำเร็จ');
      return true;
    } catch (err) {
      const { status, reason } = describeLineError(err);
      const label = status ? ` (HTTP ${status})` : '';
      if (!isRetryable(err) || attempt === LINE_MAX_ATTEMPTS) {
        const hint = lineHint(status);
        console.error(`[LINE] ส่งไม่สำเร็จ${label}: ${reason}${hint ? ` — ${hint}` : ''}`);
        return false;
      }
      const wait = retryDelay(err, attempt);
      console.warn(`[LINE] ส่งไม่สำเร็จ${label}: ${reason} — ลองใหม่ใน ${Math.round(wait / 1000)} วิ (ครั้งที่ ${attempt}/${LINE_MAX_ATTEMPTS})`);
      await sleep(wait);
    }
  }
  return false;
}

async function sendTelegram(message) {
  const { token: TG_TOKEN, chat: TG_GROUP } = tgConfig();
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
  const { token: TG_TOKEN, chat: TG_GROUP } = tgConfig();
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
    photoLinks(ticket.photos, '📎 รูปตอนแจ้ง'),
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

  // ✅ เมื่ออัปเดตมาเป็น "เสร็จสิ้น" → สรุปครบทั้งตอนแจ้งและตอนเสร็จ
  if (ticket.status === 'เสร็จสิ้น') {
    const priorityEmoji = {
      'ด่วนมาก': '🔴 ด่วนมาก', 'ด่วน': '🟡 ด่วน', 'ปกติ': '🟢 ปกติ'
    };
    const msg = [
      `✅ เสร็จสิ้น #${ticket.ticket_no}`,
      `━━━━━━━━━━━━━━━━━━`,
      `📋 รายละเอียดตอนแจ้ง`,
      `👤 ผู้แจ้ง: ${ticket.reporter_name}`,
      `📍 สถานที่: ${ticket.location}`,
      `📂 หมวดหมู่: ${ticket.category}`,
      `⚠️ ความสำคัญ: ${priorityEmoji[ticket.priority] || ticket.priority}`,
      `🩺 อาการเสีย: ${ticket.title}`,
      ticket.asset_id && ticket.asset_id !== '-' ? `🏷️ ทรัพย์สิน: ${ticket.asset_id}` : '',
      photoLinks(ticket.photos, '📎 รูปตอนแจ้ง'),
      `━━━━━━━━━━━━━━━━━━`,
      `📋 รายละเอียดตอนเสร็จ`,
      `👨‍🔧 ช่าง: ${ticket.technician}`,
      ticket.cost > 0 ? `💰 ค่าใช้จ่าย: ฿${Number(ticket.cost).toLocaleString()}` : '',
      ticket.notes ? `🔧 การแก้ไขตรวจซ่อม: ${ticket.notes}` : '',
      photoLinks(ticket.photos_done, '📸 รูปตอนเสร็จ/ผลงาน'),
      `━━━━━━━━━━━━━━━━━━`,
      `⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
    ].filter(Boolean).join('\n');

    await Promise.allSettled([sendLINE(msg), sendTelegram(msg)]);
    return;
  }

  // ขั้นกลาง (ยังไม่เสร็จสิ้น) — ฟอร์แมตสั้น
  const msg = [
    `📋 อัปเดตสถานะ #${ticket.ticket_no}`,
    `━━━━━━━━━━━━━━━━━━`,
    `${statusEmoji[oldStatus] || '❓'} ${oldStatus} → ${statusEmoji[ticket.status] || '❓'} ${ticket.status}`,
    ticket.technician && ticket.technician !== '-' ? `👨‍🔧 ช่าง: ${ticket.technician}` : '',
    ticket.cost > 0 ? `💰 ค่าใช้จ่าย: ฿${Number(ticket.cost).toLocaleString()}` : '',
    ticket.notes ? `🔧 บันทึกเพิ่มเติม: ${ticket.notes}` : '',
    `📝 ปัญหา: ${ticket.title}`,
    photoLinks(ticket.photos_done, '📸 รูปตอนเสร็จ/ผลงาน'),
    photoLinks(ticket.photos, '📎 รูปตอนแจ้ง'),
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
    ...(data.insights && data.insights.length
      ? ['━━━━━━━━━━━━━━━━━━', '🤖 AI วิเคราะห์:', ...data.insights.map(i => ` • ${i}`)]
      : []),
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
    ...(data.insights && data.insights.length
      ? ['━━━━━━━━━━━━━━━━━━', '🤖 AI วิเคราะห์:', ...data.insights.map(i => ` • ${i}`)]
      : []),
    `━━━━━━━━━━━━━━━━━━`,
    `⏰ รายงานอัตโนมัติ 16:00 น. วันศุกร์`
  ].filter(Boolean).join('\n');

  await Promise.allSettled([sendLINE(msg), sendTelegram(msg)]);
}

module.exports = {
  sendLINE, sendTelegram, sendTelegramBackup,
  notifyNewTicket, notifyStatusUpdate,
  sendDailyReport, sendWeeklyReport,
  tgConfig
};
