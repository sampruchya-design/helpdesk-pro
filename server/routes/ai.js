const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { analyzeInsights, buildCostComparison } = require('../services/ai-analysis');

const router = express.Router();

// GET /api/ai/insights — รายงานวิเคราะห์ AI (admin only)
router.get('/insights', authMiddleware, adminOnly, (req, res) => {
  const insights = analyzeInsights();
  const comparison = buildCostComparison();
  res.json({ status: 'success', insights, comparison });
});

module.exports = router;