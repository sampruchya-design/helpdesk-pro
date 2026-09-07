const express = require('express');
const { getAll, getOne } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/assets — asset history
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

  // Get last status for each asset
  assets.forEach(a => {
    if (a.asset_key.startsWith('[สถานที่] ')) {
      const loc = a.asset_key.replace('[สถานที่] ', '');
      const last = getOne('SELECT status FROM tickets WHERE location = ? ORDER BY created_at DESC LIMIT 1', [loc]);
      a.last_status = last?.status || null;
    } else {
      const last = getOne('SELECT status FROM tickets WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1', [a.asset_key]);
      a.last_status = last?.status || null;
    }
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
