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
  await loadConfigLists();
  loadDashboard();
  loadTickets();
  loadAssets();
  loadKMs();
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

function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  const btn = document.getElementById('btn-' + id);
  if (btn) btn.classList.add('active');
  if (window.innerWidth < 1024) closeSidebar();

  if (id === 'dashboard') loadDashboard();
  if (id === 'list') loadTickets();
  if (id === 'asset') loadAssets();
  if (id === 'km') loadKMs();
  if (id === 'admin') { loadUsers(); renderAdminLists(); loadTelegramSettings(); loadAiPanel(); }
}

// ===== Modals =====
function showModal(title, msg) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent = msg;
  document.getElementById('successModal').style.display = 'flex';
}
function closeModal() { document.getElementById('successModal').style.display = 'none'; }
