// ==========================================
//  KM AUTO-CATEGORY — แยกหมวดหมู่อัจฉริยะอัตโนมัติ
//  ใช้เมื่อไม่ระบุหมวดหมู่ (หรือระบุเป็น 'อื่นๆ')
// ==========================================

const RULES = [
  {
    category: 'เครื่องปรับอากาศ',
    keywords: ['แอร์', 'ปรับอากาศ', 'คอมเพรสเซอร์', 'น้ำยาแอร์', 'แฟนคอย', 'ครีล', 'ห้องเย็น', 'ยูนิทแอร์', 'ฟรีออน', 'air']
  },
  {
    category: 'ระบบไฟฟ้า',
    keywords: ['ไฟฟ้า', 'เบรกเกอร์', 'สายไฟ', 'มิเตอร์ไฟ', 'ไฟดับ', 'ไฟช็อต', 'สวิตช์', 'ปลั๊กไฟ', 'ฟิวส์', 'หลอดไฟ', 'โคมไฟ', 'แผงไฟ', 'เต้ารับ', 'ไฟรั่ว', 'แรงดันไฟฟ้า', 'ไฟไม่ติด', 'voltage', 'electric']
  },
  {
    category: 'GENERATOR',
    keywords: ['เจน', 'เจนเซ็ต', 'เจอร์เนอเรเตอร์', 'เครื่องปั่นไฟ', 'กำเนิดไฟฟ้า', 'genset', 'generator', 'ระบบสำรองไฟ']
  },
  {
    category: 'ปะปา',
    keywords: ['ปะปา', 'ประปา', 'น้ำประปา', 'วาล์วน้ำ', 'ปั๊มน้ำ', 'ท่อน้ำ', 'ถังน้ำ', 'น้ำรั่ว', 'ท่อแตก', 'ระบบน้ำ', 'สุขภัณฑ์', 'ก๊อกน้ำ', 'น้ำไหล', 'น้ำหยด', 'โฟลต', 'water', 'pump']
  },
  {
    category: 'ดาวเทียม',
    keywords: ['ดาวเทียม', 'จานดาวเทียม', 'lnb', 'ku-band', 'c-band', 'รับสัญญาณ', 'สัญญาณดาวเทียม', 'satellite', 'converter']
  },
  {
    category: 'เครื่องส่ง',
    keywords: ['เครื่องส่ง', 'กำลังส่ง', 'ทรานสมิตเตอร์', 'transmitter', 'คลื่นส่ง', 'สถานีเครื่องส่ง', 'ภาคส่ง', 'output power']
  },
  {
    category: 'TIE',
    keywords: ['tie', 'ทางเชื่อม', 'tie-in', 'transmission interface']
  },
  {
    category: 'อาคารสถานที่',
    keywords: ['อาคาร', 'หลังคา', 'กำแพง', 'เพดาน', 'ประตู', 'หน้าต่าง', 'ผนัง', 'กระเบื้อง', 'ทาสี', 'ห้องน้ำ', 'สุขา', 'ลิฟต์', 'บันได', 'โครงสร้าง', 'รั้ว', 'พัง', 'แตกร้าว', 'ฝ้า', 'ท่อระบาย', 'รางน้ำ', 'อาคารสถานที่']
  },
  {
    category: 'คอมพิวเตอร์และ IT',
    keywords: ['คอมพิวเตอร์', 'คอมฯ', 'โน้ตบุ๊ก', 'notebook', 'จอภาพ', 'จอคอม', 'เมาส์', 'คีย์บอร์ด', 'แป้นพิมพ์', 'เครือข่าย', 'network', 'เราเตอร์', 'router', 'switch', 'เน็ตเวิร์ก', 'internet', 'อินเทอร์เน็ต', 'printer', 'เครื่องพิมพ์', 'โทรศัพท์', 'เซิร์ฟเวอร์', 'server', 'wifi', 'wi-fi', 'แลน', 'โทรสาร', 'ระบบสารสนเทศ', 'database', 'ฐานข้อมูล', 'โปรแกรม', 'software', 'hardware', 'อุปกรณ์ไอที']
  }
];

function norm(s) {
  return String(s || '').toLowerCase();
}

function score(text, keywords) {
  let hit = 0;
  for (const k of keywords) {
    if (text.includes(norm(k))) hit++;
  }
  return hit;
}

function buildText(fields) {
  const parts = [
    fields.title, fields.symptom, fields.content, fields.tech_info,
    fields.steps, fields.location, fields.operator, fields.supervisor
  ];
  return parts.filter(Boolean).join(' ');
}

// หมวดหมู่ที่รู้จัก (จากกติกา) — ลำดับสำคัญ ถ้าคะแนนเท่ากันเอาเจอในรายการก่อน
function autoCategory(fields) {
  const provided = (fields && fields.category || '').trim();
  // ถ้าระบุหมวดหมู่อื่นไว้แล้ว (ไม่ใช่ 'อื่นๆ' และไม่ว่าง) → ใช้หมวดที่ให้มา
  if (provided && provided.toLowerCase() !== 'อื่นๆ') return provided;

  const text = buildText(fields || {});
  if (!text.trim()) return 'อื่นๆ';

  let best = '';
  let bestScore = 0;
  for (const rule of RULES) {
    const s = score(text, rule.keywords);
    if (s > bestScore) { bestScore = s; best = rule.category; }
  }
  return bestScore > 0 ? best : 'อื่นๆ';
}

module.exports = { autoCategory, RULES };