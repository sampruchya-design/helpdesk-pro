// ==========================================
//  SOCKET — WebSocket realtime
// ==========================================
let socket = null;

function initSocket() {
  socket = io();

  socket.on('connect', () => setSyncStatus('ok'));
  socket.on('disconnect', () => setSyncStatus('error'));

  socket.on('ticket:created', (ticket) => {
    setSyncStatus('new');
    setTimeout(() => setSyncStatus('ok'), 4000);
    refreshAfterChange();
  });

  socket.on('ticket:updated', (ticket) => {
    refreshAfterChange();
  });

  socket.on('ticket:deleted', () => {
    refreshAfterChange();
  });
}

function disconnectSocket() {
  if (socket) socket.disconnect();
}

let refreshTimeout = null;
function refreshAfterChange() {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    const active = document.querySelector('.tab-content.active');
    if (active && active.id === 'tab-dashboard') loadDashboard();
    if (active && active.id === 'tab-list') loadTickets();
    if (active && active.id === 'tab-asset') loadAssets();
  }, 500);
}

function setSyncStatus(type) {
  const wrap = document.getElementById('sync-status');
  const dot = document.getElementById('sync-dot');
  const textEl = document.getElementById('sync-text');
  if (!wrap) return;

  const states = {
    ok:      { cls: 'sync-ok',      color: 'var(--green)',  txt: 'เชื่อมต่อแล้ว' },
    loading: { cls: 'sync-loading', color: 'var(--accent)', txt: 'กำลังซิงค์...' },
    error:   { cls: 'sync-error',   color: 'var(--red)',    txt: 'เชื่อมต่อไม่ได้' },
    new:     { cls: 'sync-new',     color: 'var(--green)',  txt: '🔔 มีการอัปเดต!' },
  };
  const s = states[type] || states.ok;
  wrap.className = s.cls;
  dot.style.background = s.color;
  dot.style.boxShadow = `0 0 6px ${s.color}`;
  textEl.textContent = s.txt;
}
