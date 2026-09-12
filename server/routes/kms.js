// ==========================================
//  KM LIBRARY — ห้องสมุด KM (Knowledge Management)
//  CRUD + บันทึกผลวิเคราะห์เป็น KM + Export PDF
// ==========================================
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { runQuery, getAll, getOne } = require('../database');
const { buildKMPDF } = require('../services/pdf-export');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `km_${Date.now()}${ext}`);
  }
});

const uploadKM = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp) หรือ PDF'));
  }
});

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
    const mapped = rows.map(km => {
      let imgs = [];
      try { imgs = JSON.parse(km.images || '[]'); } catch (e) {}
      return {
        ...km,
        images: Array.isArray(imgs) ? imgs : [],
        file_url: km.file_url || ''
      };
    });
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

// POST /api/kms — อัปโหลด KM เอกสาร (file + ข้อมูล)
router.post('/', authMiddleware, adminOnly, uploadKM.array('files', 5), (req, res) => {
  try {
    const { title, category, symptom, location, operator, supervisor, content, tech_info, steps, images, ticket_no } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ status: 'error', message: 'กรุณากรอกหัวข้อเอกสาร KM' });

    // file หลัก: field 'file' เดียว หรือ file รายการใน 'files'
    let file_url = '';
    let file_type = '';
    if (req.files && req.files.length) {
      file_url = `/uploads/${req.files[0].filename}`;
      file_type = path.extname(req.files[0].originalname).toLowerCase().replace('.', '') || '';
    } else if (req.file) {
      file_url = `/uploads/${req.file.filename}`;
      file_type = path.extname(req.file.originalname).toLowerCase().replace('.', '') || '';
    }

    let imgList = [];
    try { imgList = Array.isArray(images) ? images : JSON.parse(images || '[]'); } catch (e) {}
    // รูปอื่นๆ ใน 'files' (ตั้งแต่ตัวที่ 2 ขึ้นไป)
    if (req.files && req.files.length > 1) {
      imgList.push(...req.files.slice(1).map(f => `/uploads/${f.filename}`));
    }
    imgList = imgList.filter(Boolean).slice(0, 10);

    const r = runQuery(
      `INSERT INTO kms (title, category, symptom, location, operator, supervisor, content, tech_info, steps, images, file_url, file_type, source, ticket_no, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upload', ?, ?)`,
      [title.trim(), (category || 'อื่นๆ').trim(), (symptom || '').trim(), (location || '').trim(), (operator || '').trim(),
       (supervisor || '').trim(), (content || '').trim(), (tech_info || '').trim(), (steps || '').trim(),
       JSON.stringify(imgList), file_url, file_type, (ticket_no || '').trim(),
       (req.user.name || '')]
    );
    res.json({ status: 'success', id: r.lastInsertRowid, message: 'บันทึก KM สำเร็จ' });
  } catch (e) {
    console.error('[KM] POST error:', e.message);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/kms/from-analysis — บันทึกผลวิเคราะห์ AI เป็น KM (ไม่มีไฟล์แนบ)
router.post('/from-analysis', authMiddleware, adminOnly, (req, res) => {
  try {
    const { title, category, symptom, location, operator, supervisor, content } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ status: 'error', message: 'กรุณากรอกหัวข้อเอกสาร KM' });

    const r = runQuery(
      `INSERT INTO kms (title, category, symptom, location, operator, supervisor, content, tech_info, steps, images, file_url, file_type, source, ticket_no, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '[]', '', '', 'analysis', '', ?)`,
      [title.trim(), (category || 'อื่นๆ').trim(), (symptom || '').trim(), (location || '').trim(), (operator || '').trim(),
       (supervisor || '').trim(), (content || '').trim(), (req.user.name || '')]
    );
    res.json({ status: 'success', id: r.lastInsertRowid, message: 'บันทึกผลวิเคราะห์เป็น KM แล้ว' });
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
    const base = (km.title || 'KM').replace(/[^\w\s\u0E00-\u0E7F\u0E80-\u0FFF-]+/g, '_').replace(/\s+/g, '_');
    const enc = encodeURIComponent(base || 'KM');
    const ascii = (base.replace(/[^\x00-\x7F]/g, '') || 'KM').replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${ascii}.pdf"; filename*=UTF-8''${enc}.pdf`);
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
    const base = (km.title || 'KM').replace(/[^\w\s\u0E00-\u0E7F\u0E80-\u0FFF-]+/g, '_').replace(/\s+/g, '_');
    const enc = encodeURIComponent(base || 'KM');
    const ascii = (base.replace(/[^\x00-\x7F]/g, '') || 'KM').replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${ascii}.pdf"; filename*=UTF-8''${enc}.pdf`);
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