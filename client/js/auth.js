// ==========================================
//  AUTH — รหัสพนักงาน Login
// ==========================================
let currentUser = null;

const CATEGORY_NEEDS_DETAIL = ['ดาวเทียม', 'เครื่องส่ง', 'TIE', 'อาคารสถานที่', 'คอมพิวเตอร์และ IT', 'อื่นๆ'];
const LOCATION_NEEDS_DETAIL = ['สถานีเสริม', 'อื่นๆ'];

async function handleLogin(e) {
  e.preventDefault();
  const code = document.getElementById('code-input').value.trim();
  const errEl = document.getElementById('login-error');

  if (!code) {
    errEl.style.display = 'block';
    errEl.textContent = 'กรุณากรอกรหัสพนักงาน';
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังตรวจ...';

  try {
    const res = await API.post('/api/auth/login', { code });
    localStorage.setItem('token', res.token);
    localStorage.setItem('currentUser', JSON.stringify(res.user));
    currentUser = res.user;
    applyRolePermissions();
    showApp();
    initSocket();
    bootApp();
  } catch (err) {
    errEl.style.display = 'block';
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'เข้าสู่ระบบ';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  currentUser = null;
  disconnectSocket();
  location.reload();
}

function applyRolePermissions() {
  const admin = currentUser && currentUser.role === 'admin';
  document.getElementById('displayUsername').textContent = currentUser.name + (currentUser.position ? ' · ' + currentUser.position : '');
  document.getElementById('displayRole').textContent = currentUser.role === 'admin' ? '⭐ ผู้ดูแลระบบ' : (currentUser.position || '👤 พนักงาน');
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });
}