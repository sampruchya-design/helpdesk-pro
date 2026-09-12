// ==========================================
//  AI ANALYSIS — วิเคราะห์ข้อมูลตั๋วแจ้งซ่อม (rule-based, ฟรี ไม่ต้อง API key)
//  สรุป insight เป็นภาษาไทยสำหรับหน้าแอดมิน + รายงานอัตโนมัติ
// ==========================================
const { getAll, getOne, getSetting } = require('../database');
const { safeJsonParse } = require('./utils');
const { slaAvgHours, overdueCount } = require('./stats');

function getRefPrices() {
  const p = safeJsonParse(getSetting('REF_COST_PRICE') || '{}', {});
  return typeof p === 'object' && p !== null ? p : {};
}

// เปรียบเทียบ "เราทำเอง" vs "จ้างภายนอก" ต่อหมวด โดยใช้ราคาอ้างอิงที่แอดมินตั้งไว้
function buildCostComparison() {
  const ref = getRefPrices();
  const cats = getAll(`
    SELECT category,
      COUNT(*) as c,
      COALESCE(SUM(cost), 0) as self_cost,
      COALESCE(SUM(parts_cost), 0) as parts_cost,
      COALESCE(SUM(labor_cost), 0) as labor_cost
    FROM tickets WHERE cost IS NOT NULL AND cost > 0
    GROUP BY category
  `);
  const totalSelf = { category: '(รวมทั้งหมด)', c: 0, self_cost: 0, parts_cost: 0, labor_cost: 0 };

  const rows = cats.filter(x => ref[x.category] > 0).map(x => {
    const refPrice = ref[x.category];
    const extCost = refPrice * x.c;
    totalSelf.c += x.c;
    totalSelf.self_cost += x.self_cost;
    totalSelf.parts_cost += (x.parts_cost || 0);
    totalSelf.labor_cost += (x.labor_cost || 0);
    return {
      category: x.category,
      count: x.c,
      refPrice,
      cost: x.self_cost,
      extCost,
      diff: x.self_cost - extCost,   // ติดลบ = เราทำเองถูกกว่า, บวก = เราทำเองแพงกว่าจ้าง
      diffPct: extCost > 0 ? Math.round((x.self_cost - extCost) / extCost * 100) : 0,
      parts_cost: x.parts_cost || 0,
      labor_cost: x.labor_cost || 0
    };
  });

  totalSelf.extCost = rows.reduce((s, r) => s + r.extCost, 0);
  totalSelf.diff = totalSelf.self_cost - totalSelf.extCost;
  totalSelf.diffPct = totalSelf.extCost > 0 ? Math.round(totalSelf.diff / totalSelf.extCost * 100) : 0;

  return { ref, rows, total: totalSelf };
}

function costInsights(comp) {
  const out = [];
  if (!comp.rows.length) return out;
  const worst = comp.rows.filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff)[0];
  const best = comp.rows.filter(r => r.diff <= 0).sort((a, b) => a.diff - b.diff)[0];
  if (worst) {
    out.push(`💰 ค่าใช้จ่ายจริงของ "${worst.category}" (฿${worst.cost.toLocaleString()}) สูงกว่าราคาอ้างอิงจ้างภายนอก (฿${worst.extCost.toLocaleString()}) ถึง ฿${worst.diff.toLocaleString()} (${worst.diffPct}%) — ทบทวนการทำเอง/เบิกจ่าย`);
  } else {
    out.push(`💰 การซ่อมเองทั้งหมดถูกกว่าราคาจ้างภายนอกอ้างอิง — ประหยัดได้รวม ฿${(-comp.total.diff).toLocaleString()} คุ้มค่า`);
  }
  if (best) {
    out.push(`💹 หมวดที่คุ้มค่าที่สุดที่เราทำเอง: "${best.category}" ประหยัด ฿${(-best.diff).toLocaleString()} จากราคาจ้างอ้างอิง`);
  }
  if (comp.total.diff > 0) {
    out.push(`📊 ภาพรวม ถ้าจ้างภายนอกทั้งหมดจะใช้ ฿${comp.total.extCost.toLocaleString()} แต่เราจ่ายจริง ฿${comp.total.self_cost.toLocaleString()} (มากกว่า ฿${comp.total.diff.toLocaleString()})`);
  } else {
    out.push(`📊 ภาพรวม ซ่อมเองประหยัดกว่า ฿${(-comp.total.diff).toLocaleString()} เทียบกับการจ้างภายนอกทั้งหมด`);
  }
  // หมวดที่ยังไม่ได้ตั้งราคาอ้างอิง → กระตุ้นให้ตั้ง
  const ref = comp.ref;
  const catsWithCost = getAll('SELECT DISTINCT category FROM tickets WHERE cost > 0');
  const unset = catsWithCost.filter(x => !ref[x.category]).map(x => x.category);
  if (unset.length) {
    out.push(`🔔 ยังไม่ได้ตั้งราคาอ้างอิงสำหรับ: ${unset.slice(0, 4).join(', ')}${unset.length > 4 ? ' และอื่นๆ' : ''} — ตั้งเพื่อให้ AI เปรียบเทียบค่าใช้จ่ายได้ครบ`);
  }
  return out;
}

function analyzeInsights() {
  const total = getOne('SELECT COUNT(*) as c FROM tickets');
  const insights = [];

  if (!total || total.c === 0) {
    return ['ยังไม่มีข้อมูลแจ้งซ่อม — เมื่อมีงานเข้ามาระบบจะวิเคราะห์ให้อัตโนมัติ'];
  }

  // 1. หมวดหมู่ที่พบบ่อย
  const topCats = getAll('SELECT category, COUNT(*) as c FROM tickets GROUP BY category ORDER BY c DESC LIMIT 2');
  if (topCats.length) {
    const t = topCats[0];
    const share = Math.round((t.c / total.c) * 100);
    insights.push(`หมวดที่แจ้งซ่อมบ่อยที่สุดคือ "${t.category}" จำนวน ${t.c} ครั้ง คิดเป็น ${share}% ของงานทั้งหมด${topCats[1] ? ` รองลงมา "${topCats[1].category}" (${topCats[1].c} ครั้ง)` : ''}`);
  }

  // 2. สถานที่ใช้ค่าใช้จ่ายสูงสุด
  const topCostLoc = getOne('SELECT location, SUM(cost) as tc FROM tickets GROUP BY location ORDER BY tc DESC LIMIT 1');
  if (topCostLoc && topCostLoc.tc > 0) {
    insights.push(`สถานที่ใช้ค่าใช้จ่ายสะสมสูงสุดคือ "${topCostLoc.location}" รวม ฿${Number(topCostLoc.tc).toLocaleString()}`);
  }

  // 3. ทรัพย์สินซ่อมซ้ำบ่อย (>=3 ครั้ง → ถึงเวลาเปลี่ยน)
  const repeatAssets = getAll(`
    SELECT asset_id, location, COUNT(*) as c
    FROM tickets WHERE asset_id IS NOT NULL AND asset_id != '-'
    GROUP BY asset_id HAVING c >= 3 ORDER BY c DESC LIMIT 3
  `);
  if (repeatAssets.length) {
    const ra = repeatAssets[0];
    insights.push(`⚠️ ทรัพย์สิน "${ra.asset_id}" (${ra.location}) ถูกแจ้งซ่อมถึง ${ra.c} ครั้งแล้ว — พิจารณาเปลี่ยนใหม่หรือตรวจซ่อมใหญ่` + (repeatAssets[1] ? ` (รองลงมา ${repeatAssets[1].asset_id}: ${repeatAssets[1].c} ครั้ง)` : ''));
  }

  // 4. งานค้างเกิน 3 วัน
  const overdue = overdueCount();
  if (overdue > 0) {
    insights.push(`มีงานค้างเกิน 3 วัน ${overdue} รายการ — ควรรีบจัดลำดับดำเนินการ`);
  } else {
    insights.push(`ไม่มีงานค้างเกิน 3 วัน — สถานะงานอยู่ในเกณฑ์ดี`);
  }

  // 5. เวลาเฉลี่ยเริ่มซ่อม (SLA)
  const sla = slaAvgHours();
  if (sla) {
    const h = Math.round(sla * 10) / 10;
    insights.push(`เวลาเฉลี่ยจากรับงานถึงเริ่มซ่อม/เสร็จ ≈ ${h} ชั่วโมง`);
  }

  // 6. ช่างที่ทำงานมากสุด
  const topTech = getOne(`
    SELECT technician, COUNT(*) as c FROM tickets
    WHERE technician IS NOT NULL AND technician != '-'
    GROUP BY technician ORDER BY c DESC LIMIT 1
  `);
  if (topTech) {
    insights.push(`ช่างที่รับงานมากที่สุดคือ "${topTech.technician}" (${topTech.c} งาน)`);
  }

  // 7. แนวโน้มเดือนนี้ vs เดือนก่อน
  const thisMon = getOne("SELECT COUNT(*) as c, COALESCE(SUM(cost),0) as tc FROM tickets WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')");
  const lastMon = getOne("SELECT COUNT(*) as c, COALESCE(SUM(cost),0) as tc FROM tickets WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime','-1 month')");
  if (lastMon.c > 0) {
    const d = Math.round(((thisMon.c - lastMon.c) / lastMon.c) * 100);
    insights.push(`ปริมาณงานเดือนนี้ ${thisMon.c} งาน เทียบเดือนก่อน ${lastMon.c} งาน (${d >= 0 ? '+' : ''}${d}%) | ค่าใช้จ่ายเดือนนี้ ฿${Number(thisMon.tc).toLocaleString()}`);
  } else if (thisMon.c > 0) {
    insights.push(`เดือนนี้มีงาน ${thisMon.c} รายการ ค่าใช้จ่ายรวม ฿${Number(thisMon.tc).toLocaleString()}`);
  }

  // 8. คอขวดรออะไหล่
  const waitingParts = getOne(`
    SELECT COUNT(*) as c, MAX(julianday('now','localtime') - julianday(created_at)) as oldest_days
    FROM tickets WHERE status = 'รออะไหล่'
  `);
  if (waitingParts.c > 0) {
    insights.push(`งานที่รออะไหล่ ${waitingParts.c} รายการ (เก่าสุดค้างมา ${Math.round(waitingParts.oldest_days)} วัน) — ตรวจสอบการสั่งซื้อ`);
  }

  // 9. เปรียบเทียบค่าใช้จ่าย ซ่อมเอง vs จ้างภายนอก
  insights.push(...costInsights(buildCostComparison()));

  return insights;
}

module.exports = { analyzeInsights, buildCostComparison, costInsights };