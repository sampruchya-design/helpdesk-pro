const JWT_SECRET = process.env.JWT_SECRET || '';

const PLACEHOLDERS = [
  'change-this-to-a-long-random-string',
  'helpdesk-pro-secret',
  ''
];

function assertJwtSecret() {
  if (PLACEHOLDERS.includes(JWT_SECRET)) {
    const msg = [
      '❌ JWT_SECRET ยังไม่ได้ตั้งค่าที่ปลอดภัย',
      '   แก้ไขไฟล์ .env → กำหนด JWT_SECRET เป็น string สุ่มยาวๆ (เช่นผลลัพธ์จาก: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")',
      '   (รับประกันว่า token ไม่สามารถปลอมได้)'
    ].join('\n');
    throw new Error(msg);
  }
}

module.exports = { JWT_SECRET, assertJwtSecret };