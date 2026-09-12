// ==========================================
//  KM AUTO-FROM-TICKET — สร้าง KM อัตโนมัติจากงานแจ้งซ่อมที่ปิดแล้ว
//  Trigger: เมื่อ ticket เปลี่ยนเป็น 'เสร็จสิ้น' (ดู server/routes/tickets.js)
//  กติกา: สร้างเฉพาะงานที่มีแนวทางซ่อมจริง (notes มีสาระ)
//         + ระบบเติมข้อมูลให้สมบูรณ์ (สถานที่/อุปกรณ์/ผู้ซ่อม/รูป/หมวดหมู่อัจฉริยะ)
//         + กันซ้ำ (1 ticket → 1 KM ถ้า source = auto-ticket)
// ==========================================
const { getOne, getAll } = require('../database');
const { insertKM } = require('./km-store');
const { safeJsonParse } = require('./utils');

// notes ต้องมีสาระพอที่จะเป็นแนวทางซ่อมได้ (ไม่งั้นข้าม ไม่ทำ KM ก้อนเปล่า)
function hasRealGuideline(notes) {
  const text = String(notes || '').trim();
  if (text.length < 15) return false;
  const tiny = ['เสร็จเรียบร้อย', 'เสร็จแล้ว', 'เรียบร้อยแล้ว', 'เสร็จสิ้น', 'แก้ไขแล้ว', 'แก้แล้ว', 'ซ่อมเสร็จ', 'ok', 'เสร็จ', 'done'];
  const lower = text.toLowerCase();
  if (tiny.some(t => lower === t)) return false;
  return true;
}

// ถ้าพารามิเตอร์มีตัวจริงก็ใส่เข้าไป (กันซ้ำ: location_detail อาจถูกรวมเข้า location แล้ว)
function pickLocation(t) {
  const loc = (t.location || '').trim();
  const det = (t.location_detail || '').trim();
  if (loc && det && (loc.includes(det) || det.includes(loc))) return loc;
  if (loc && det) return `${loc} — ${det}`;
  return loc || det;
}

// สร้าง KM จาก ticket (คืน { created: true } หรือ { created: false, reason })
function createKMFromTicket(ticket) {
  try {
    if (!ticket || !ticket.id) return { created: false, reason: 'no-ticket' };

    // กันซ้ำ: ticket นี้ถูกสร้าง KM แบบ auto แล้ว
    const dup = getOne(
      `SELECT id FROM kms WHERE ticket_no = ? AND source = 'auto-ticket'`,
      [ticket.ticket_no || '']
    );
    if (dup) return { created: false, reason: 'duplicate', km_id: dup.id };

    // เฉพาะงานที่เสร็จสิ้นจริง
    if (ticket.status !== 'เสร็จสิ้น') return { created: false, reason: 'not-completed' };

    const guideline = String(ticket.notes || '').trim();
    if (!hasRealGuideline(guideline)) return { created: false, reason: 'no-guideline' };

    const images = [];
    const done = safeJsonParse(ticket.photos_done || '[]', []);
    const reported = safeJsonParse(ticket.photos || '[]', []);
    // ใช้รูปตอนเสร็จก่อน ถ้าไม่มี เอาภาพตอนนี้ไปก่อน (ให้ KM มีภาพประกอบเสมอ)
    const doneList = Array.isArray(done) ? done.filter(Boolean).slice(0, 10) : [];
    if (doneList.length) images.push(...doneList);
    else if (Array.isArray(reported)) images.push(...reported.filter(Boolean).slice(0, 10));

    const title = (ticket.title || '').trim();
    const loc = pickLocation(ticket) || '';
    const techExtra = (ticket.category_detail || '').trim();
    const assetExtra = (ticket.asset_id && ticket.asset_id !== '-' ? `\n- อุปกรณ์/ทรัพย์สิน: ${ticket.asset_id}` : '');
    // เทมเพลตมาตรฐาน 5 ส่วน: รวบรวมข้อมูลจากงานบังจริง → เก็บตามฟิลด์ (symptom/content/tech_info/steps)
    const content = [
      '**เหตุการณ์:**',
      `${title}`,
      '',
      `**ที่มา/แนวทางการตรวจซ่อม:**`,
      guideline
    ].join('\n');
    const techInfo = `${techExtra ? `- หมวดย่อยงาน: ${techExtra}` : '- หมวดย่อยงาน: -'}${assetExtra}`;
    // แนวทางซ่อมที่กรอกตอนปิดงาน → ใส่เข้า "ขั้นตอนการตรวจซ่อม" ให้ PDF/การ์ดแสดงครบ 5 ส่วน
    const steps = guideline;

    // ticket.category ในระบบแจ้งซ่อมคือระดับความจำเป็น (จำเป็น/ด่วน/ปกติ) ไม่ใช่หมวดระบบจริง
    // → ส่งให้ autoCategory เฉพาะเมื่อตรงกับหมวดหมู่จริงในตาราง categories เฉยๆ
    let seedCategory = '';
    try {
      const known = getAll('SELECT name FROM categories').map(r => r.name);
      if (known.includes((ticket.category || '').trim())) seedCategory = ticket.category;
    } catch (e) {}

    const r = insertKM({
      source: 'auto-ticket',
      title,
      category: seedCategory,
      symptom: title,
      location: loc,
      operator: (ticket.technician || '').trim(),
      supervisor: (ticket.reporter_name || '').trim(),
      content, tech_info: techInfo, steps,
      images,
      ticket_no: (ticket.ticket_no || '').trim(),
      created_by: (ticket.technician || ticket.tech_by || 'ระบบ').trim()
    });

    return { created: true, id: r.id, category: r.category };
  } catch (e) {
    console.error('[KM-Auto] สร้างจากงานแจ้งซ่อมไม่สำเร็จ:', e.message);
    return { created: false, reason: e.message };
  }
}

// เช็คว่าจะสร้างได้หรือไม่ (ใช้ตอนเรียกแบบ manual เช่น ปุ่ม "สร้าง KM จากงานนี้")
function previewKMFromTicket(ticket) {
  return {
    willCreate: ticket && ticket.status === 'เสร็จสิ้น' && hasRealGuideline(ticket.notes),
    hasGuideline: !!ticket && hasRealGuideline(ticket.notes)
  };
}

module.exports = { createKMFromTicket, previewKMFromTicket, hasRealGuideline };