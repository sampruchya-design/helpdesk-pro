// ==========================================
//  UTILS — ฟังก์ชันใช้ร่วมกัน (routes/services)
// ==========================================

// JSON.parse แบบปลอดภัย (ล้ม = คืน fallback) — หยุดทวน try/catch ทุกจุด
function safeJsonParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v;
  } catch (e) {
    return fallback;
  }
}

// ปกติ/ป้องกัน query page=abc, limit=-1 → คืนค่าที่ถูกต้องเสมอ
function sanitizePagination(query, defPage = 1, defLimit = 50) {
  const page = Math.max(1, parseInt(query.page, 10) || defPage);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, offset: (page - 1) * limit };
}

// ปรับชื่อไฟล์ให้พิมพ์ได้ทั้ง Unicode (filename*) และ ascii (fallback)
function sanitizeFilename(title) {
  const base = String(title || 'KM')
    .replace(/[^\w\s\u0E00-\u0E7F\u0E80-\u0FFF-]+/g, '_')
    .replace(/\s+/g, '_').replace(/^_+|_+$/g, '') || 'KM';
  return {
    base,
    enc: encodeURIComponent(base),
    ascii: (base.replace(/[^\x00-\x7F]/g, '') || 'KM').replace(/[^\w.-]+/g, '_')
  };
}

// header สำหรับดาวน์โหลด PDF — ใช้ที่ทุก endpoint export
function pdfDownloadHeaders(res, title) {
  const { enc, ascii } = sanitizeFilename(title);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${ascii}.pdf"; filename*=UTF-8''${enc}.pdf`);
}

module.exports = { safeJsonParse, sanitizePagination, sanitizeFilename, pdfDownloadHeaders };