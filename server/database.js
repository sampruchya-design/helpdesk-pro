const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'database.db');

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

let db = null;
let dirty = false;
let saveTimer = null;

async function getDB() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  initSchema();
  saveDB();

  // Auto-save every 5 seconds if dirty
  setInterval(() => {
    if (dirty) saveDB();
  }, 5000);

  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
  dirty = false;
}

function markDirty() {
  dirty = true;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  // NOTE: db.export() (inside saveDB) RESETS last_insert_rowid() to 0,
  // so capture rowid/changes BEFORE persisting.
  const meta = db.exec('SELECT last_insert_rowid() AS rowid, changes() AS changed');
  const row = (meta[0] && meta[0].values && meta[0].values[0]) || [0, 0];
  markDirty();
  saveDB();
  return { lastInsertRowid: row[0], changes: row[1] };
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function getLastInsertId() {
  const row = getOne('SELECT last_insert_rowid() as id');
  return row ? row.id : null;
}

function initSchema() {
  ensureUserSchema();
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS technicians (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no       TEXT UNIQUE,
      reporter_id     INTEGER REFERENCES users(id),
      reporter_name   TEXT,
      category        TEXT,
      category_detail TEXT,
      priority        TEXT DEFAULT 'ปกติ',
      location        TEXT,
      location_detail TEXT,
      asset_id        TEXT,
      title           TEXT,
      photo_url       TEXT,
      status          TEXT DEFAULT 'รอดำเนินการ',
      technician      TEXT,
      cost            REAL DEFAULT 0,
      notes           TEXT,
      created_at      DATETIME DEFAULT (datetime('now','localtime')),
      updated_at      DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sla_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER REFERENCES tickets(id),
      from_status TEXT,
      to_status   TEXT,
      changed_by  INTEGER REFERENCES users(id),
      changed_at  DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.run('CREATE TABLE IF NOT EXISTS kms (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT DEFAULT \'อื่นๆ\', symptom TEXT DEFAULT \'\', location TEXT DEFAULT \'\', operator TEXT DEFAULT \'\', supervisor TEXT DEFAULT \'\', content TEXT DEFAULT \'\', tech_info TEXT DEFAULT \'\', steps TEXT DEFAULT \'\', images TEXT DEFAULT \'[]\', file_url TEXT DEFAULT \'\', file_type TEXT DEFAULT \'\', source TEXT DEFAULT \'upload\', ticket_no TEXT DEFAULT \'\', created_by TEXT DEFAULT \'\', created_at DATETIME DEFAULT (datetime(\'now\',\'localtime\')), updated_at DATETIME DEFAULT (datetime(\'now\',\'localtime\')))');

  // Indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sla_log_ticket ON sla_log(ticket_id)');
  ensureKMSchema();
  ensureTicketSchema();

  markDirty();
  seedDefaults();
  backfillUserPins();
}

function backfillUserPins() {
  // ผู้ใช้เก่าที่ยังไม่มีพาส → ตั้งค่าพาสเริ่มต้น = รหัสพนักงานของตัวเอง (แอดมินเปลี่ยนทีหลังได้)
  const rows = getAll("SELECT id, code FROM users WHERE pin IS NULL OR pin = ''");
  rows.forEach(r => {
    db.run('UPDATE users SET pin = ? WHERE id = ?', [hashPin(r.code), r.id]);
  });
}

function ensureUserSchema() {
  const r = db.exec('PRAGMA table_info(users)');
  const names = r.length && r[0] ? r[0].values.map(v => v[1]) : [];
  if (!names.includes('code')) {
    db.run('DROP TABLE IF EXISTS users');
    db.run(`
      CREATE TABLE users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        code        TEXT UNIQUE,
        pin         TEXT,
        name        TEXT NOT NULL,
        role        TEXT DEFAULT 'user',
        position    TEXT,
        active      INTEGER DEFAULT 1,
        created_at  DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);
  } else if (!names.includes('position')) {
    db.run('ALTER TABLE users ADD COLUMN position TEXT');
  }
}

function ensureTicketSchema() {
  const r = db.exec('PRAGMA table_info(tickets)');
  const names = r.length && r[0] ? r[0].values.map(v => v[1]) : [];
  if (!names.includes('parts_cost')) db.run('ALTER TABLE tickets ADD COLUMN parts_cost REAL DEFAULT 0');
  if (!names.includes('labor_cost')) db.run('ALTER TABLE tickets ADD COLUMN labor_cost REAL DEFAULT 0');
  if (!names.includes('photos')) db.run("ALTER TABLE tickets ADD COLUMN photos TEXT DEFAULT '[]'");
  if (!names.includes('photos_done')) db.run("ALTER TABLE tickets ADD COLUMN photos_done TEXT DEFAULT '[]'");
}

function ensureKMSchema() {
  const r = db.exec('PRAGMA table_info(kms)');
  const names = r.length && r[0] ? r[0].values.map(v => v[1]) : [];
  if (!names.includes('symptom')) db.run("ALTER TABLE kms ADD COLUMN symptom TEXT DEFAULT ''");
}

function seedDefaults() {
  const catCount = getOne('SELECT COUNT(*) as c FROM categories');
  if (catCount.c === 0) {
    const cats = [
      'เครื่องปรับอากาศ', 'ระบบไฟฟ้า', 'GENERATOR', 'อาคาร',
      'ปะปา', 'ดาวเทียม', 'เครื่องส่ง', 'TIE',
      'อาคารสถานที่', 'คอมพิวเตอร์และ IT', 'อื่นๆ'
    ];
    cats.forEach(c => runQuery('INSERT OR IGNORE INTO categories (name) VALUES (?)', [c]));
  }

  const locCount = getOne('SELECT COUNT(*) as c FROM locations');
  if (locCount.c === 0) {
    const locs = ['สถานีสระแก้ว', 'สถานีระยอง', 'สถานีตราด', 'สถานีเสริม', 'อื่นๆ'];
    locs.forEach(l => runQuery('INSERT OR IGNORE INTO locations (name) VALUES (?)', [l]));
  }

  const userCount = getOne('SELECT COUNT(*) as c FROM users');
  if (userCount.c === 0) {
    runQuery('INSERT INTO users (code, name, role) VALUES (?, ?, ?)', ['admin', 'Admin Admin', 'admin']);
    const employees = [
      ['00174', 'ชัยเจริญวงษ์ วันคำ'],
      ['00235', 'ทนงกฤช ชูยศ'],
      ['01263', 'ณรงค์ฤทธิ์ สุวรรณะ'],
      ['00357', 'วัลลภ โหรี'],
      ['01004', 'ปรัชญา แปกลาง'],
      ['01339', 'ธิดารัตน์ ขาวผ่อง'],
      ['01424', 'ใหม่ โปร่งจิต'],
      ['01440', 'ณัฐพล ลิ้มสุวรรณ']
    ];
    employees.forEach(([code, name]) => {
      runQuery('INSERT INTO users (code, name, role) VALUES (?, ?, ?)', [code, name, 'user']);
    });
  }

  // ตั้งตำแหน่ง (position) ตามรหัสพนักงาน — รันทุกครั้ง (ไม่ง้อ seed ใหม่)
  const positions = {
    '00174': 'หัวหน้าส่วนงาน',
    '00235': 'วิศวกร อาวุโส',
    '01263': 'วิศวกร อาวุโส',
    '00357': 'เจ้าหน้าที่เทคนิค อาวุโส',
    '01004': 'เจ้าหน้าที่เทคนิค',
    '01339': 'เจ้าหน้าที่เทคนิค',
    '01424': 'เจ้าหน้าที่เทคนิค',
    '01440': 'พนักงานเทคนิค'
  };
  Object.entries(positions).forEach(([code, position]) => {
    runQuery('UPDATE users SET position = ? WHERE code = ?', [position, code]);
  });
  runQuery('UPDATE users SET position = ? WHERE code = ?', ['ผู้ดูแลระบบ', 'admin']);

  saveDB();
}

function getSetting(key) {
  const r = getOne('SELECT value FROM settings WHERE key = ?', [key]);
  return r ? r.value : null;
}

function setSetting(key, value) {
  runQuery(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

function generateTicketNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const date = `${y}${m}${d}`;

  const row = getOne("SELECT COUNT(*) as c FROM tickets WHERE ticket_no LIKE ?", [`RQ-${date}-%`]);
  const seq = String((row.c || 0) + 1).padStart(3, '0');
  return `RQ-${date}-${seq}`;
}

module.exports = { getDB, runQuery, getAll, getOne, getLastInsertId, generateTicketNo, saveDB, getSetting, setSetting, hashPin };
