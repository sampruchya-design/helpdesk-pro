const express = require('express');
const { getAll, getOne } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/assets — asset history (2 queries: aggregate แล้ว join last status — กำจัด N+1)
router.get('/', authMiddleware, (req, res) => {
  const assets = getAll(`
    SELECT
      CASE WHEN asset_id IS NOT NULL AND asset_id != '-' THEN asset_id
           ELSE '[สถานที่] ' || location END as asset_key,
      COUNT(*) as repair_count,
      SUM(cost) as total_cost,
      MAX(created_at) as last_date
    FROM tickets
    GROUP BY asset_key
    ORDER BY repair_count DESC
  `);

  if (!assets.length) return res.json({ status: 'success', assets });

  // last status: JOIN status ล่าสุดของแต่ละ asset ครั้งเดียว — ไม่ต้อง loop ยิง query ทีละตัว
  const lastById = {};
  const lastByLoc = {};
  getAll(`
    SELECT key, status
    FROM (
      SELECT asset_id AS key, status, created_at,
        ROW_NUMBER() OVER (PARTITION BY CASE WHEN asset_id IS NOT NULL AND asset_id != '-' THEN asset_id ELSE '[สถานที่] ' || location END ORDER BY created_at DESC, id DESC) rn
      FROM tickets
    ) WHERE rn = 1 AND key IS NOT NULL
  `).forEach(r => {
    if (String(r.key).startsWith('[สถานที่] ')) lastByLoc[r.key] = r.status;
    else lastById[r.key] = r.status;
  });

  assets.forEach(a => {
    a.last_status = String(a.asset_key).startsWith('[สถานที่] ')
      ? (lastByLoc[a.asset_key] || null)
      : (lastById[a.asset_key] || null);
  });

  res.json({ status: 'success', assets });
});

// GET /api/assets/:key — single asset history
router.get('/:key', authMiddleware, (req, res) => {
  const key = decodeURIComponent(req.params.key);
  let tickets;

  if (key.startsWith('[สถานที่] ')) {
    const loc = key.replace('[สถานที่] ', '');
    tickets = getAll('SELECT * FROM tickets WHERE location = ? ORDER BY created_at DESC', [loc]);
  } else {
    tickets = getAll('SELECT * FROM tickets WHERE asset_id = ? ORDER BY created_at DESC', [key]);
  }

  res.json({ status: 'success', tickets });
});

module.exports = router;
