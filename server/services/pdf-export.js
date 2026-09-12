// ==========================================
//  PDF EXPORT — สร้างเอกสาร KM แบบ .pdf (pdf-lib + ฟอนต์ไทย Kanit จาก Google Fonts)
//  แบบฟอร์มอ้างอิง: KM (knowledge management) ของส่วนงานวิศวกรรม
//    หน้า 1 ปก: KM / ตรวจซ่อม [หัวข้อ] / ภาพ / สถานที่ / ผู้ปฏิบัติงาน / ผู้บังคับบัญชา
//    จากนั้น: เหตุการณ์ → ข้อมูลเทคนิคของอุปกรณ์ → ขั้นตอนการตรวจซ่อม → รูปแสดงอุปกรณ์
// ==========================================
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const KANIT = {
  regular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kanit/Kanit-Regular.ttf',
  bold: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kanit/Kanit-Bold.ttf',
  light: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kanit/Kanit-Light.ttf'
};

let fontBufferCache = {};
async function loadFontBytes(key) {
  if (fontBufferCache[key]) {
    try { return new Uint8Array(fontBufferCache[key].slice()); } catch (e) {}
  }
  // 1) ลองโหลดจาก disk (เก็บไว้หลังโหลดครั้งแรกเพื่อให้ทำงานแบบ offline/เร็ว)
  const local = path.join(__dirname, '..', 'fonts', `${key}.ttf`);
  if (fs.existsSync(local)) {
    const buf = fs.readFileSync(local);
    fontBufferCache[key] = buf;
    return new Uint8Array(buf);
  }
  // 2) ดาวน์โหลดจาก Google Fonts (GitHub raw)
  const res = await axios.get(KANIT[key], { responseType: 'arraybuffer', timeout: 30000 });
  const buf = Buffer.from(res.data);
  fontBufferCache[key] = buf;
  // เก็บไว้ disk เผื่อครั้งหน้า
  try {
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, buf);
  } catch (e) {}
  return new Uint8Array(buf);
}
function getFont(doc, key) {
  // PDFFont ผูกกับ document ที่ embed → ต้อง embed ใหม่ทุกครั้ง (Cache แค่ raw bytes)
  return loadFontBytes(key).then(bytes => doc.embedFont(bytes));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function wrapText(ctxFont, text, maxWidth, size) {
  const chars = Array.from(text);
  const lines = [];
  let cur = '';
  for (const ch of chars) {
    if (ctxFont.widthOfTextAtSize(cur + ch, size) > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const W = 595, H = 842, M = 42, MAXW = W - M * 2;

function drawHeader(doc, page, fontBold, fontLight) {
  page.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: hexToRgb('#0b1220') });
  page.drawRectangle({ x: 0, y: H - 63, width: W, height: 3, color: hexToRgb('#00d4ff') });
  page.drawText('KM (Knowledge Management)', { x: M, y: H - 30, size: 13, font: fontBold, color: hexToRgb('#00d4ff') });
  page.drawText('Thai PBS · HelpdeskPro ระบบจัดการความรู้', { x: M, y: H - 48, size: 8, font: fontLight, color: hexToRgb('#9fb3c8') });
  page.drawText('ส่วนงานวิศวกรรมสระแก้ว ฝ่ายระบบส่งสัญญาณ ภาค 1 สำนักวิศวกรรม', { x: W - M, y: H - 30, size: 8, font: fontLight, color: hexToRgb('#9fb3c8'), xMax: W - M, align: 'right' });
}

function beginPage(doc, fontBold, fontLight) {
  const page = doc.addPage([W, H]);
  if (fontBold && fontLight) drawHeader(doc, page, fontBold, fontLight);
  return page;
}

function drawWorkBox(page, km, fontBold, fontReg, yTop) {
  const bw = 300, bh = 140, bx = (W - bw) / 2;
  page.drawRectangle({ x: bx - 4, y: yTop - bh - 4, width: bw + 8, height: bh + 8, color: hexToRgb('#0b1220'), opacity: 0.05 });
  page.drawRectangle({ x: bx, y: yTop - bh, width: bw, height: bh, borderColor: hexToRgb('#0b1220'), borderWidth: 1.2, color: hexToRgb('#ffffff') });
  page.drawRectangle({ x: bx, y: yTop - 24, width: bw, height: 24, color: hexToRgb('#0b1220') });
  page.drawText('1. ส่วนหัวและข้อมูลทั่วไป', { x: bx + 8, y: yTop - 17, size: 10, font: fontBold, color: hexToRgb('#ffffff') });
  const field = (label, value, yy) => {
    page.drawText(label, { x: bx + 8, y: yy, size: 9, font: fontBold, color: hexToRgb('#0b1220') });
    const v = String(value || '-');
    const wrapped = wrapText(fontReg, v, bw - 130, 9);
    page.drawText(wrapped.length ? wrapped[0] : '', { x: bx + 130, y: yy, size: 9, font: fontReg, color: hexToRgb('#334155') });
    if (wrapped.length > 1) page.drawText(wrapped[1], { x: bx + 130, y: yy - 13, size: 9, font: fontReg, color: hexToRgb('#334155') });
    if (wrapped.length > 2) page.drawText(wrapped[2], { x: bx + 130, y: yy - 26, size: 9, font: fontReg, color: hexToRgb('#334155') });
  };
  field('สถานที่ปฏิบัติงาน', km.location, yTop - 42);
  field('เจ้าหน้าที่ผู้ปฏิบัติงาน', km.operator, yTop - 66);
  field('ผู้บังคับบัญชา/ที่ปรึกษา', km.supervisor, yTop - 88);
  field('จัดทำโดย (ส่วนงาน)', km.created_by || '-', yTop - 112);
  return yTop - bh;
}

function drawImageInPage(page, doc, file_url, fontReg, x, y, maxW, maxH) {
  if (!file_url || !/\.(png|jpe?g|gif|webp)$/i.test(file_url)) return false;
  const fp = path.join(__dirname, '..', 'uploads', path.basename(file_url));
  if (!fs.existsSync(fp)) return false;
  try {
    const bytes = fs.readFileSync(fp);
    const img = /\.png$/i.test(file_url) ? doc.embedPng(bytes) : doc.embedJpg(bytes);
    const ratio = img.height / img.width;
    let iw = maxW, ih = iw * ratio;
    if (ih > maxH) { ih = maxH; iw = ih / ratio; }
    page.drawImage(img, { x: x + (maxW - iw) / 2, y: y - ih, width: iw, height: ih });
    return true;
  } catch (e) {
    console.error('[PDF] แนบรูปไม่สำเร็จ:', e.message);
    return false;
  }
}

async function buildKMPDF(km) {
  const doc = await PDFDocument.create();
  if (typeof doc.registerFontkit === 'function') doc.registerFontkit(fontkit);
  const fontBold = await getFont(doc, 'bold');
  const fontReg = await getFont(doc, 'regular');
  const fontLight = await getFont(doc, 'light');

  // ===== หน้า 1: ปก =====
  const cover = beginPage(doc, fontBold, fontLight);
  let y = H - 150;

  cover.drawText('KM (Knowledge Management)', { x: M, y, size: 13, font: fontLight, color: hexToRgb('#8a6d3b') });
  y -= 8;
  cover.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: hexToRgb('#e2e8f0') });
  y -= 34;

  cover.drawText('ตรวจซ่อม', { x: M, y, size: 20, font: fontReg, color: hexToRgb('#64748b') });
  y -= 34;
  const titleWrapped = wrapText(fontBold, km.title || 'งานซ่อม', MAXW, 26);
  titleWrapped.forEach(l => { cover.drawText(l, { x: M, y, size: 26, font: fontBold, color: hexToRgb('#0b1220') }); y -= 34; });
  y -= 6;

  // รูปปก (จาก file_url หรือรูปแรกใน images)
  let coverImgDrawn = drawImageInPage(cover, doc, km.file_url, fontReg, M, y, MAXW, 190);
  if (!coverImgDrawn) coverImgDrawn = drawImageInPage(cover, doc, (km.images || [])[0], fontReg, M, y, MAXW, 190);
  if (coverImgDrawn) y -= 220;

  const boxBottom = drawWorkBox(cover, km, fontBold, fontReg, y);
  y = boxBottom - 40;

  // ===== เนื้อหา: เหตุการณ์ =====
  let page = cover;
  const ensureRoom = (need) => { if (y < need) { page = beginPage(doc, fontBold, fontLight); y = H - 110; return true; } return false; };
  const drawHeading = (num, title) => {
    ensureRoom(70);
    y -= 4;
    page.drawText(`${num}. ${title}`, { x: M, y, size: 15, font: fontBold, color: hexToRgb('#0b1220') });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: hexToRgb('#00d4ff') });
    y -= 14;
  };
  const drawLines = (text) => {
    const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(l => {
      // รองรับ markdown หัวข้อย่อย (**ข้อความ**) → วาดเป็นบรรทัดเน้นเข้ม
      const boldHead = /^\*\*(.+?)\*\*\s*:?$/.exec(l);
      const body = l.replace(/^\*\*(.+?)\*\*\s*:?\s*/, '');
      const wrapped = wrapText(fontReg, body, MAXW, 12);
      wrapped.forEach(w => {
        ensureRoom(30);
        if (boldHead && w === wrapped[0]) {
          page.drawText(w, { x: M, y, size: 12, font: fontBold, color: hexToRgb('#0b1220') });
        } else {
          page.drawText(w, { x: M, y, size: 12, font: fontReg, color: hexToRgb('#1e293b') });
        }
        y -= 20;
      });
    });
    y -= 8;
  };

  drawHeading(2, 'เหตุการณ์และที่มา (Incident & Background)');
  if (km.symptom && String(km.symptom).trim()) {
    drawLines(`🩺 อาการผิดปกติ: ${String(km.symptom).trim()}`);
  }
  drawLines(km.content || '-');

  drawHeading(3, 'ข้อมูลเทคนิคของอุปกรณ์ (Technical Specifications)');
  drawLines(km.tech_info || '-');

  drawHeading(4, 'ขั้นตอนการตรวจซ่อม (Troubleshooting & Repair Steps)');
  drawLines(km.steps || '-');

  // ===== 5. รูปแสดงอุปกรณ์และหลักฐาน =====
  drawHeading(5, 'รูปแสดงอุปกรณ์และหลักฐาน (Visual Evidence)');
  let photos = Array.isArray(km.images) ? km.images : [];
  if (!Array.isArray(km.images)) { try { photos = JSON.parse(km.images || '[]'); } catch (e) { photos = []; } }
  photos = (photos || []).filter(Boolean);
  if (photos.length) {
    photos.forEach((u, idx) => {
      if (y < 210) { page = beginPage(doc, fontBold, fontLight); y = H - 110; }
      const drawn = drawImageInPage(page, doc, u, fontReg, M, y, MAXW / 2 - 6, 180);
      if (drawn) {
        y -= 205;
        page.drawText(`รูปที่ 1.${idx + 1} ${km.title || 'รูปประกอบการตรวจซ่อม'}`, { x: M + 2, y, size: 8, font: fontLight, color: hexToRgb('#94a3b8'), maxWidth: MAXW - 4 });
        y -= 16;
      }
    });
  } else {
    drawLines('(ไม่มีการแนบรูป)');
  }

  // footer
  ensureRoom(90);
  y -= 18;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: hexToRgb('#e2e8f0') });
  page.drawText(`📋 หมายเลขงาน: ${km.ticket_no || '-'}  ·  หมวดหมู่: ${km.category || 'อื่นๆ'}`, { x: M, y: y - 14, size: 9, font: fontLight, color: hexToRgb('#94a3b8') });
  page.drawText(`ออกเอกสารโดย: HelpdeskPro KM Library · ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`, { x: M, y: y - 28, size: 9, font: fontLight, color: hexToRgb('#94a3b8') });

  return Buffer.from(await doc.save());
}

module.exports = { buildKMPDF, getFont };