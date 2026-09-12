// ==========================================
//  STATS — query สถิติกลาง (ใช้ซ้ำที่ dashboard / ai-analysis / scheduler)
// ==========================================
const { getOne } = require('../database');

// เวลาเฉลี่ยจาก "รับงาน" (รอดำเนินการ) ถึง "เริ่มซ่อม/เสร็จสิ้น" (ชั่วโมง)
function slaAvgHours() {
  const sla = getOne(`
    SELECT AVG((julianday(s2.changed_at) - julianday(s1.changed_at)) * 24) as avg_hours
    FROM sla_log s1
    JOIN sla_log s2 ON s1.ticket_id = s2.ticket_id
    WHERE s1.to_status = 'รอดำเนินการ' AND s2.to_status IN ('กำลังซ่อม', 'เสร็จสิ้น')
  `);
  return sla && sla.avg_hours != null ? sla.avg_hours : null;
}

// จำนวนงานค้างเกิน 3 วัน (ยังไม่เสร็จ)
const OVERDUE_STATUSES = "('รอดำเนินการ', 'กำลังซ่อม', 'รออะไหล่', 'ส่งซ่อมภายนอก')";
function overdueCount() {
  const r = getOne(`
    SELECT COUNT(*) as c FROM tickets
    WHERE status IN ${OVERDUE_STATUSES}
    AND julianday('now','localtime') - julianday(created_at) > 3
  `);
  return r ? r.c : 0;
}

module.exports = { slaAvgHours, overdueCount, OVERDUE_STATUSES };