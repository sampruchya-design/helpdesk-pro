// ==========================================
//  KM STORE — สร้างเอกสาร KM กลาง (ใช้ซ้ำที่ routes/kms)
//  รวม: auto-categorize เมื่อไม่ระบุหมวด + INSERT ไว้จุดเดียว ป้องกันโค้ดซ้ำ
// ==========================================
const { runQuery } = require('../database');
const { autoCategory } = require('./km-categorize');

function insertKM({ source = 'upload', title = '', category = '', symptom = '', location = '', operator = '', supervisor = '', content = '', tech_info = '', steps = '', images = [], file_url = '', file_type = '', ticket_no = '', created_by = '' } = {}) {
  const finalCategory = autoCategory({
    category,
    symptom,
    location,
    operator,
    supervisor,
    title: String(title || '').trim(),
    content,
    tech_info: tech_info || '',
    steps: steps || ''
  });

  const r = runQuery(
    `INSERT INTO kms (title, category, symptom, location, operator, supervisor, content, tech_info, steps, images, file_url, file_type, source, ticket_no, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(title || '').trim(),
      finalCategory,
      (symptom || '').trim(),
      (location || '').trim(),
      (operator || '').trim(),
      (supervisor || '').trim(),
      (content || '').trim(),
      (tech_info || '').trim(),
      (steps || '').trim(),
      JSON.stringify(Array.isArray(images) ? images : []),
      file_url || '',
      file_type || '',
      source,
      (ticket_no || '').trim(),
      (created_by || '').trim()
    ]
  );
  return { id: r.lastInsertRowid, category: finalCategory };
}

module.exports = { insertKM };