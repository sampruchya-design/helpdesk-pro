// ==========================================
//  KM LIBRARY — ห้องสมุด KM (Knowledge Management)
//  CRUD + บันทึกผลวิเคราะห์เป็น KM + Export PDF
// ==========================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { getAll, getOne, runQuery } = require('../database');
const { buildKMPDF } = require('../services/pdf-export');
const { insertKM } = require('../services/km-store');
const { createUpload } = require('../services/upload');
const { safeJsonParse, pdfDownloadHeaders } = require('../services/utils');

const router = express.Router();

const uploadKM = createUpload({ prefix: 'km', maxFiles: 11 });

// GET /api/kms — รายการ KM ทั้งหมด (รองรับ filter: ?category= , ?q= ค้นหาอาการเสีย/หัวข้อ/เนื้อหา)
router.get('/', authMiddleware, (req, res) => {
  try {
    let rows = getAll('SELECT * FROM kms ORDER BY created_at DESC');
    const cat = (req.query.category || '').trim();
    const q = (req.query.q || '').trim().toLowerCase();
    if (cat) rows = rows.filter(k => (k.category || '').trim().toLowerCase() === cat.toLowerCase());
    if (q) rows = rows.filter(k =>
      [k.title, k.symptom, k.content, k.location, k.operator, k.ticket_no, k.category]
        .some(v => String(v || '').toLowerCase().includes(q))
    );
    const mapped = rows.map(km => ({
      ...km,
      images: (() => { const imgs = safeJsonParse(km.images || '[]', []); return Array.isArray(imgs) ? imgs : []; })(),
      file_url: km.file_url || ''
    }));
    res.json({ status: 'success', kms: mapped, total: mapped.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/kms/categories — หมวดหมู่ทั้งหมด (จากตาราง categories + ที่มีใน KM)
router.get('/categories', authMiddleware, (req, res) => {
  try {
    const cats = getAll('SELECT name FROM categories ORDER BY name');
    const kmCats = getAll('SELECT DISTINCT category FROM kms WHERE category <> \'\'')
      .map(r => r.category).filter(Boolean);
    const all = [...new Set([...cats.map(c => c.name), ...kmCats])].sort((a, b) => a.localeCompare(b, 'th'));
    res.json({ status: 'success', categories: all });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/kms — อัปโหลด KM เอกสาร (file + ข้อมูล) — ทุกคนที่ login ได้
router.post('/', authMiddleware, uploadKM.array('files', 11), (req, res) => {
  try {
    const { title, category, symptom, location, operator, supervisor, content, tech_info, steps, images, ticket_no } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ status: 'error', message: 'กรุณากรอกหัวข้อเอกสาร KM' });

    // file หลัก: ตัวแรกใน 'files' (ปก หรือ เอกสาร PDF) ส่วนตัวที่เหลือเป็นรูปประกอบ
    let file_url = '';
    let file_type = '';
    if (req.files && req.files.length) {
      file_url = `/uploads/${req.files[0].filename}`;
      file_type = path.extname(req.files[0].originalname).toLowerCase().replace('.', '') || '';
    }

    let imgList = [];
    if (Array.isArray(images)) imgList = images;
    else imgList = safeJsonParse(images || '[]', []);
    // รูปอื่นๆ ใน 'files' (ตั้งแต่ตัวที่ 2 ขึ้นไป)
    if (req.files && req.files.length > 1) {
      imgList.push(...req.files.slice(1).map(f => `/uploads/${f.filename}`));
    }
    imgList = imgList.filter(Boolean).slice(0, 10);

    const result = insertKM({
      source: 'upload',
      title, category, symptom, location, operator, supervisor,
      content, tech_info, steps, images: imgList,
      file_url, file_type, ticket_no,
      created_by: (req.user.name || '')
    });
    const io = req.app.get('io');
    if (io) io.emit('km:created', { id: result.id });
    res.json({ status: 'success', id: result.id, message: 'บันทึก KM สำเร็จ' });
  } catch (e) {
    console.error('[KM] POST error:', e.message);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/kms/from-analysis — บันทึกผลวิเคราะห์ AI เป็น KM — ทุกคนที่ login ได้ (ไม่มีไฟล์แนบ)
router.post('/from-analysis', authMiddleware, (req, res) => {
  try {
    const { title, category, symptom, location, operator, supervisor, content } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ status: 'error', message: 'กรุณากรอกหัวข้อเอกสาร KM' });

    const result = insertKM({
      source: 'analysis',
      title, category, symptom, location, operator, supervisor, content,
      created_by: (req.user.name || '')
    });
    res.json({ status: 'success', id: result.id, message: 'บันทึกผลวิเคราะห์เป็น KM แล้ว' });
  } catch (e) {
    console.error('[KM] from-analysis error:', e.message);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/kms/:id/pdf — Export PDF เอกสาร KM
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const km = getOne('SELECT * FROM kms WHERE id = ?', [Number(req.params.id)]);
    if (!km) return res.status(404).json({ status: 'error', message: 'ไม่พบเอกสาร KM' });

    const pdf = await buildKMPDF(km);
    pdfDownloadHeaders(res, km.title);
    res.send(pdf);
  } catch (e) {
    console.error('[KM] PDF error:', e.message);
    res.status(500).json({ status: 'error', message: 'สร้าง PDF ไม่สำเร็จ: ' + e.message });
  }
});

// POST /api/kms/export-pdf — สร้าง PDF จากข้อมูล JSON (ไม่ต้องบันทึก — ใช้กับปุ่ม Export ปัจจุบัน)
router.post('/export-pdf', authMiddleware, async (req, res) => {
  try {
    const km = {
      title: req.body.title || 'งานซ่อม',
      category: req.body.category || 'อื่นๆ',
      symptom: req.body.symptom || '',
      location: req.body.location || '',
      operator: req.body.operator || '',
      supervisor: req.body.supervisor || '',
      content: req.body.content || '',
      ticket_no: req.body.ticket_no || '',
      file_url: req.body.file_url || ''
    };
    const pdf = await buildKMPDF(km);
    pdfDownloadHeaders(res, km.title);
    res.send(pdf);
  } catch (e) {
    console.error('[KM] export-pdf error:', e.message);
    res.status(500).json({ status: 'error', message: 'สร้าง PDF ไม่สำเร็จ: ' + e.message });
  }
});

// DELETE /api/kms/:id — ลบเอกสาร KM + ไฟล์
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const km = getOne('SELECT * FROM kms WHERE id = ?', [Number(req.params.id)]);
    if (!km) return res.status(404).json({ status: 'error', message: 'ไม่พบเอกสาร KM' });

    // ลบไฟล์บน disk (file_url + รูปใน images)
    const files = [];
    if (km.file_url && km.file_url.startsWith('/uploads/')) files.push(km.file_url);
    try { const imgs = JSON.parse(km.images || '[]'); if (Array.isArray(imgs)) files.push(...imgs); } catch (e) {}
    files.filter(f => typeof f === 'string' && f.startsWith('/uploads/')).forEach(f => {
      const fp = path.join(__dirname, '..', 'uploads', path.basename(f));
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) {}
    });
    runQuery('DELETE FROM kms WHERE id = ?', [Number(req.params.id)]);
    res.json({ status: 'success', message: 'ลบเอกสาร KM แล้ว' });
  } catch (e) {
    console.error('[KM] DELETE error:', e.message);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/kms/preview/:file — เปิดไฟล์ KM (รูป/PDF)
router.get('/preview/:file', authMiddleware, (req, res) => {
  const name = path.basename(req.params.file);
  const fp = path.join(__dirname, '..', 'uploads', name);
  if (!fs.existsSync(fp)) return res.status(404).json({ status: 'error', message: 'ไม่พบไฟล์' });
  res.sendFile(fp);
});

module.exports = router;