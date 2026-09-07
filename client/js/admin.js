// ==========================================
//  ADMIN — จัดการหมวดหมู่/สถานที่/ช่าง/ผู้ใช้
// ==========================================
let allUsers = [];

function renderAdminLists() {
  const catList = document.getElementById('categoryList');
  const locList = document.getElementById('locationList');
  const techList = document.getElementById('technicianList');

  catList.innerHTML = categoryList.map(c => `
    <li>${c.name}<button onclick="removeItem('category',${c.id})">✕</button></li>`).join('');

  locList.innerHTML = locationList.map(l => `
    <li>${l.name}<button onclick="removeItem('location',${l.id})">✕</button></li>`).join('');

  techList.innerHTML = technicianList.map(t => `
    <li>${t.name}<button onclick="removeItem('technician',${t.id})">✕</button></li>`).join('');
}

async function addItem(type) {
  const map = {
    category: ['newCategory', '/api/config/categories'],
    location: ['newLocation', '/api/config/locations'],
    technician: ['newTechnician', '/api/config/technicians']
  };
  const [inputId, url] = map[type];
  const val = document.getElementById(inputId).value.trim();
  if (!val) return;

  try {
    await API.post(url, { name: val });
    document.getElementById(inputId).value = '';
    await loadConfigLists();
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

async function removeItem(type, id) {
  if (!confirm('ต้องการลบใช่หรือไม่?')) return;
  const map = {
    category: '/api/config/categories',
    location: '/api/config/locations',
    technician: '/api/config/technicians'
  };
  try {
    await API.del(`${map[type]}/${id}`);
    await loadConfigLists();
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

// ===== User Management =====
async function loadUsers() {
  try {
    const res = await API.get('/api/auth/users');
    allUsers = res.users;
    renderUserList();
  } catch (err) {
    console.error('โหลดผู้ใช้ไม่สำเร็จ:', err);
  }
}

function renderUserList() {
  const el = document.getElementById('userList');
  el.innerHTML = allUsers.map(u => `
    <li style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;background:rgba(0,212,255,0.03);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#e2eaf7;">${u.name}</div>
        <div style="font-size:10px;color:var(--text-muted);">
          ${u.code ? `<span style="color:var(--accent);">${u.code}</span> · ` : ''}${u.role === 'admin' ? '⭐ แอดมิน' : '👤 พนักงาน'}${u.active ? '' : ' · 🚫 ปิดใช้งาน'}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button onclick="openUserEdit(${u.id})" style="padding:5px 10px;border-radius:6px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">แก้ไข</button>
        <button onclick="toggleUserActive(${u.id}, ${u.active ? 0 : 1})" style="padding:5px 10px;border-radius:6px;background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);color:var(--yellow);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">${u.active ? 'ปิด' : 'เปิด'}</button>
      </div>
    </li>`).join('');
}

function openUserModal(title, user) {
  document.getElementById('userModalTitle').textContent = title;
  document.getElementById('editUserId').value = user ? user.id : '';
  document.getElementById('editUserName').value = user ? user.name : '';
  document.getElementById('editUserCode').value = user ? user.code || '' : '';
  document.getElementById('editUserRole').value = user ? user.role || 'user' : 'user';
  document.getElementById('userModal').style.display = 'flex';
}
function closeUserModal() { document.getElementById('userModal').style.display = 'none'; }

function openUserEdit(id) {
  const u = allUsers.find(x => x.id === id);
  if (u) openUserModal('แก้ไขผู้ใช้', u);
}
function openUserCreate() { openUserModal('เพิ่มผู้ใช้ใหม่', null); }

async function saveUser() {
  const id = document.getElementById('editUserId').value;
  const name = document.getElementById('editUserName').value.trim();
  const code = document.getElementById('editUserCode').value.trim();
  const role = document.getElementById('editUserRole').value;

  if (!name) { showModal('กรุณากรอกชื่อ', ''); return; }
  if (!id && !code) { showModal('กรุณากรอกรหัสพนักงาน', 'ต้องมีรหัสพนักงานสำหรับผู้ใช้ใหม่'); return; }

  try {
    if (id) {
      const payload = { name, role };
      if (code) payload.code = code;
      await API.put(`/api/auth/users/${id}`, payload);
    } else {
      await API.post('/api/auth/register', { code, name, role });
    }
    closeUserModal();
    await loadUsers();
    showModal('บันทึกสำเร็จ', 'ข้อมูลผู้ใช้ถูกบันทึกแล้ว');
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

async function toggleUserActive(id, active) {
  try {
    await API.put(`/api/auth/users/${id}`, { active });
    await loadUsers();
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

async function exportData(format) {
  try {
    const res = await fetch(`/api/export/${format}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('ส่งออกไม่สำเร็จ');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tickets_export.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

async function backupDatabase() {
  try {
    const res = await fetch('/api/backup', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('สำรองข้อมูลไม่สำเร็จ');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `helpdeskpro-backup-${new Date().toISOString().slice(0, 10)}.db`;
    a.click();
    URL.revokeObjectURL(a.href);
    showModal('สำเร็จ', 'ไฟล์ฐานข้อมูลถูกดาวน์โหลดแล้ว — เก็บไว้ที่ปลอดภัย');
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

// ===== Telegram Settings =====
const tgStatusEl = () => document.getElementById('tgStatus');

async function loadTelegramSettings() {
  try {
    const res = await API.get('/api/settings');
    if (res.settings) {
      document.getElementById('tgToken').value = res.settings.TELEGRAM_BOT_TOKEN || '';
      document.getElementById('tgChatId').value = res.settings.TELEGRAM_GROUP_CHAT_ID || '';
      tgStatusEl().textContent = res.settings.TELEGRAM_BOT_TOKEN ? '✅ ตั้งค่าไว้แล้ว — กดส่งข้อความทดสอบได้' : 'ยังไม่ตั้งค่า — กรอก Bot Token และ Chat ID';
    }
  } catch (err) {
    console.error('โหลด Telegram settings ไม่สำเร็จ:', err);
  }
}

async function saveTelegramSettings() {
  const token = document.getElementById('tgToken').value.trim();
  const chatId = document.getElementById('tgChatId').value.trim();
  if (!token || !chatId) {
    tgStatusEl().textContent = '⚠️ กรอกทั้ง Bot Token และ Chat ID ให้ครบ';
    return;
  }
  try {
    const res = await API.put('/api/settings', { TELEGRAM_BOT_TOKEN: token, TELEGRAM_GROUP_CHAT_ID: chatId });
    tgStatusEl().textContent = '💾 ' + res.message;
  } catch (err) {
    tgStatusEl().textContent = '❌ ' + err.message;
  }
}

async function testTelegram() {
  tgStatusEl().textContent = '⏳ กำลังส่ง...';
  try {
    const res = await API.post('/api/settings/telegram-test', {});
    tgStatusEl().textContent = res.message;
  } catch (err) {
    tgStatusEl().textContent = '❌ ' + err.message;
  }
}