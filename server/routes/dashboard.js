const express = require('express');
const { getAll, getOne } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { slaAvgHours } = require('../services/stats');

const router = express.Router();

// GET /api/dashboard — summary stats
router.get('/', authMiddleware, (req, res) => {
  const total = getOne('SELECT COUNT(*) as c FROM tickets');
  const byStatus = getAll('SELECT status, COUNT(*) as count FROM tickets GROUP BY status');

  const statusMap = { 'รอดำเนินการ': 0, 'กำลังซ่อม': 0, 'รออะไหล่': 0, 'ส่งซ่อมภายนอก': 0, 'เสร็จสิ้น': 0 };
  byStatus.forEach(r => { if (statusMap[r.status] !== undefined) statusMap[r.status] = r.count; });

  const byCategory = getAll('SELECT category, COUNT(*) as count FROM tickets GROUP BY category ORDER BY count DESC');
  const byLocation = getAll('SELECT location, SUM(cost) as total_cost, COUNT(*) as count FROM tickets GROUP BY location ORDER BY total_cost DESC');
  const totalCost = getOne('SELECT COALESCE(SUM(cost), 0) as total FROM tickets');

  const techStats = getAll(`
    SELECT technician,
      SUM(CASE WHEN status = 'รอดำเนินการ' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'กำลังซ่อม' THEN 1 ELSE 0 END) as doing,
      SUM(CASE WHEN status = 'รออะไหล่' THEN 1 ELSE 0 END) as waiting_parts,
      SUM(CASE WHEN status = 'ส่งซ่อมภายนอก' THEN 1 ELSE 0 END) as outsourced,
      SUM(CASE WHEN status = 'เสร็จสิ้น' THEN 1 ELSE 0 END) as done,
      SUM(cost) as total_cost
    FROM tickets WHERE technician IS NOT NULL AND technician != '-'
    GROUP BY technician ORDER BY done DESC
  `);

  const year = new Date().getFullYear();
  const slaAvg = slaAvgHours();
  const monthlyCost = getAll(`
    SELECT
      CAST(strftime('%m', created_at) AS INTEGER) as month,
      SUM(cost) as total_cost,
      COUNT(*) as count
    FROM tickets WHERE strftime('%Y', created_at) = ?
    GROUP BY month ORDER BY month
  `, [String(year)]);

  res.json({
    status: 'success',
    total: total.c,
    statuses: statusMap,
    byCategory,
    byLocation,
    totalCost: totalCost.total,
    techStats,
    slaAvgHours: slaAvg != null ? Math.round(slaAvg * 10) / 10 : null,
    monthlyCost
  });
});

module.exports = router;
