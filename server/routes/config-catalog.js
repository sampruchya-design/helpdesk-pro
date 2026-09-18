// ==========================================
//  CONFIG CATALOG ROUTER — หนึ่ง module สร้าง CRUD สำหรับ table catalog ใดๆ
//  (categories / locations / technicians) → กำจัด duplication 3 ชุด endpoint ใน server.js
// ==========================================
const express = require('express');
const { getAll, runQuery } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

function createCatalogRouter({ table, key, label, orderBy = 'id', orderDir = 'ASC' }) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', (req, res) => {
    const rows = getAll(`SELECT * FROM ${table} ORDER BY ${orderBy} ${orderDir}`);
    res.json({ status: 'success', [key]: rows });
  });

  router.post('/', adminOnly, (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ status: 'error', message: `กรุณากรอกชื่อ${label}` });
    try {
      runQuery(`INSERT INTO ${table} (name) VALUES (?)`, [name.trim()]);
      res.json({ status: 'success', message: 'เพิ่มสำเร็จ' });
    } catch (e) {
      res.status(409).json({ status: 'error', message: 'ชื่อนี้มีอยู่แล้ว' });
    }
  });

  router.delete('/:id', adminOnly, (req, res) => {
    runQuery(`DELETE FROM ${table} WHERE id = ?`, [Number(req.params.id)]);
    res.json({ status: 'success' });
  });

  return router;
}

module.exports = createCatalogRouter;