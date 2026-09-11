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
        <div style="font-size:13px;font-weight:600;color:#e2eaf7;">${u.name}
          ${u.position ? `<span style="font-size:10px;font-weight:400;color:var(--text-muted);"> · ${u.position}</span>` : ''}
        </div>
        <div style="font-size:10px;color:var(--text-muted);">
          ${u.code ? `<span style="color:var(--accent);">${u.code}</span> · ` : ''}${u.role === 'admin' ? '⭐ แอดมิน' : (u.position || '👤 พนักงาน')}${u.pin_set ? ' · 🔒' : ''}${u.active ? '' : ' · 🚫 ปิดใช้งาน'}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button onclick="openUserEdit(${u.id})" style="padding:5px 10px;border-radius:6px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">แก้ไข</button>
        <button onclick="toggleUserActive(${u.id}, ${u.active ? 0 : 1})" style="padding:5px 10px;border-radius:6px;background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);color:var(--yellow);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">${u.active ? 'ปิด' : 'เปิด'}</button>
        ${u.role !== 'admin' ? `<button onclick="deleteUser(${u.id})" style="padding:5px 10px;border-radius:6px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);color:#f87171;font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">ลบ</button>` : ''}
      </div>
    </li>`).join('');
}

function openUserModal(title, user) {
  document.getElementById('userModalTitle').textContent = title;
  document.getElementById('editUserId').value = user ? user.id : '';
  document.getElementById('editUserName').value = user ? user.name : '';
  document.getElementById('editUserCode').value = user ? user.code || '' : '';
  document.getElementById('editUserRole').value = user ? user.role || 'user' : 'user';
  document.getElementById('editUserPosition').value = user ? user.position || '' : '';
  document.getElementById('editUserPin').value = '';
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
  const position = document.getElementById('editUserPosition').value.trim();
  const pin = document.getElementById('editUserPin').value.trim();

  if (!name) { showModal('กรุณากรอกชื่อ', ''); return; }
  if (!id && !code) { showModal('กรุณากรอกรหัสพนักงาน', 'ต้องมีรหัสพนักงานสำหรับผู้ใช้ใหม่'); return; }

  try {
    if (id) {
      const payload = { name, role, position };
      if (code) payload.code = code;
      if (pin) payload.pin = pin;
      await API.put(`/api/auth/users/${id}`, payload);
    } else {
      await API.post('/api/auth/register', { code, name, role, position, pin });
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

async function deleteUser(id) {
  const u = (allUsers || []).find(x => x.id === id);
  if (!u) return;
  if (!confirm(`ลบ ${u.name} (${u.code}) ออกจากระบบ?\nงานที่เคยแจ้งไว้จะยังอยู่ แต่พนักงานนี้จะล็อกอินไม่ได้`)) return;
  try {
    await API.del(`/api/auth/users/${id}`);
    await loadUsers();
    showModal('ลบสำเร็จ', `ลบ ${u.name} แล้ว`);
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

// ===== AI Panel =====
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadAiPanel() {
  const insEl = document.getElementById('aiInsights');
  const compEl = document.getElementById('aiCostComp');
  insEl.textContent = '⏳ กำลังวิเคราะห์ข้อมูล...';
  try {
    const res = await API.get('/api/ai/insights');
    insEl.innerHTML = (res.insights || ['ไม่มีข้อมูล']).map(i => '• ' + escapeHtml(i)).join('<br>');
    await renderRefPriceFields();

    let html = '';
    if (res.comparison && res.comparison.rows && res.comparison.rows.length) {
      html = `<table class="data-table"><thead><tr><th style="text-align:left;">หมวด</th><th style="text-align:center;">ครั้ง</th><th style="text-align:right;">💰 จ่ายจริง</th><th style="text-align:right;">อ้างอิงจ้างร้าน</th><th style="text-align:right;">🆚 ต่าง</th></tr></thead><tbody>`;
      res.comparison.rows.forEach(r => {
        const cls = r.diff > 0 ? 'color:#f87171;' : 'color:#34d399;';
        html += `<tr><td style="text-align:left;">${escapeHtml(r.category)}</td><td style="text-align:center;">${r.count}</td><td style="text-align:right;">฿${Number(r.cost).toLocaleString()}</td><td style="text-align:right;">฿${Number(r.extCost).toLocaleString()}</td><td style="text-align:right;${cls}">${r.diff > 0 ? '+' : ''}฿${Number(r.diff).toLocaleString()}</td></tr>`;
      });
      const t = res.comparison.total;
      html += `<tr style="font-weight:700;border-top:1px solid rgba(255,255,255,0.15);"><td style="text-align:left;">รวมทุกหมวด</td><td style="text-align:center;">${t.c}</td><td style="text-align:right;">฿${Number(t.self_cost).toLocaleString()}</td><td style="text-align:right;">฿${Number(t.extCost).toLocaleString()}</td><td style="text-align:right;${t.diff > 0 ? 'color:#f87171;' : 'color:#34d399;'}">${t.diff > 0 ? '+' : ''}฿${Number(t.diff).toLocaleString()}</td></tr></tbody></table>`;
    }
    compEl.innerHTML = html || '';
  } catch (err) {
    insEl.textContent = '❌ ' + err.message;
  }
}

async function renderRefPriceFields() {
  const el = document.getElementById('refPriceFields');
  try {
    const [cats, st] = await Promise.all([
      API.get('/api/config/categories'),
      API.get('/api/settings')
    ]);
    const ref = (st.settings && st.settings.REF_COST_PRICE) || {};
    el.innerHTML = (cats.categories || []).map(c => {
      const name = (c && typeof c === 'object') ? (c.name || '') : String(c);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
        <span style="flex:1;">${escapeHtml(name)}</span>
        <input type="number" min="0" step="10" data-ref-price="${escapeHtml(name)}" value="${ref[name] != null ? ref[name] : ''}" class="inp" style="width:110px;text-align:right;" placeholder="฿">
      </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = '<span style="color:#f87171;">โหลดหมวดหมู่ไม่สำเร็จ</span>';
  }
}

async function saveRefPrices() {
  const ref = {};
  document.querySelectorAll('#refPriceFields [data-ref-price]').forEach(inp => {
    const v = Number(inp.value);
    if (isFinite(v) && v > 0) ref[inp.getAttribute('data-ref-price')] = Math.round(v);
  });
  try {
    await API.put('/api/settings', { REF_COST_PRICE: ref });
    showModal('บันทึกแล้ว', 'ราคาอ้างอิงถูกบันทึก — AI จะวิเคราะห์งบจากนี้');
    loadAiPanel();
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}