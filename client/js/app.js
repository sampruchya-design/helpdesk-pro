// ==========================================
//  APP — main boot + navigation + modals
// ==========================================
window.onload = function() {
  const mh = document.getElementById('mobile-header');
  const sc = document.getElementById('sidebar-close');
  if (window.innerWidth < 1024) { mh.style.display = 'flex'; sc.style.display = 'block'; }
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) { mh.style.display = 'none'; sc.style.display = 'none'; }
    else { mh.style.display = 'flex'; sc.style.display = 'block'; }
  });

  setTimeout(() => {
    document.getElementById('loader').style.display = 'none';
    checkLoginStatus();
  }, 600);
};

function checkLoginStatus() {
  const token = localStorage.getItem('token');
  const saved = getCurrentUser();
  if (token && saved) {
    currentUser = saved;
    applyRolePermissions();
    showApp();
    initSocket();
    bootApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginForm').onsubmit = handleLogin;
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

async function bootApp() {
  // Lazy loading: โหลด config + dashboard เท่านั้นตอน boot — ที่เหลือโหลดเมื่อเปิด tab ครั้งแรก (ประหยัด fetch ซ้ำ)
  await ConfigStore.load();
  loadDashboard();
}

// ===== Sidebar =====
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ===== Tabs คลัง (TTL) — ป้องกันโหลดซ้ำซ้อนเมื่อสลับไป-มาภายใน 5 วิ (socket refresh ยังบังคับได้)
let tabLoadedAt = {};
let tabLoading = {};
function recentlyLoaded(id) {
  // ถ้ายังโหลดค้างอยู่ ไม่ต้องโหลดซ้อน (รอให้เสร็จแล้ว reader ที่สลับกลับมาจะได้ข้อมูลใหม่)
  if (tabLoading[id]) return true;
  return tabLoadedAt[id] && (Date.now() - tabLoadedAt[id]) < 5000;
}
function markTabLoaded(id) { tabLoadedAt[id] = Date.now(); tabLoading[id] = false; }

async function withTabGuard(id, fn) {
  tabLoading[id] = true;
  try { return await fn(); }
  finally { tabLoading[id] = false; }
}

function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  const btn = document.getElementById('btn-' + id);
  if (btn) btn.classList.add('active');
  if (window.innerWidth < 1024) closeSidebar();

  // admin เป็นหน้าที่แก้ข้อมูลบ่อย → โหลดใหม่เสมอ; ส่วนอื่น lazy + TTL
  if (id === 'admin') {
    loadUsers(); renderAdminLists(); loadTelegramSettings(); loadAiPanel();
    return;
  }
  if (recentlyLoaded(id)) return;

  if (id === 'dashboard') withTabGuard('dashboard', loadDashboard);
  if (id === 'list') withTabGuard('list', loadTickets);
  if (id === 'asset') withTabGuard('asset', loadAssets);
  if (id === 'km') withTabGuard('km', loadKMs);
  markTabLoaded(id);
}

// ===== Modals =====
function showModal(title, msg) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent = msg;
  document.getElementById('successModal').style.display = 'flex';
}
function closeModal() { document.getElementById('successModal').style.display = 'none'; }
