// ==========================================
//  TICKET LIST — รายการแจ้งซ่อม
// ==========================================
let ticketData = [];

async function loadTickets() {
  try {
    const res = await API.get('/api/tickets?limit=200');
    ticketData = res.tickets;
    renderList();
  } catch (err) {
    console.error('โหลดรายการไม่สำเร็จ:', err);
  }
}

function getStatusBadge(status) {
  const map = {
    'รอดำเนินการ': '<span class="badge badge-wait">⏳ รอดำเนินการ</span>',
    'กำลังซ่อม': '<span class="badge badge-doing">🔧 กำลังซ่อม</span>',
    'รออะไหล่': '<span class="badge badge-parts">📦 รออะไหล่</span>',
    'ส่งซ่อมภายนอก': '<span class="badge badge-out">📤 ส่งซ่อมภายนอก</span>',
    'เสร็จสิ้น': '<span class="badge badge-done">✅ เสร็จสิ้น</span>',
  };
  return map[status] || `<span class="badge badge-wait">⏳ ${status || 'รอดำเนินการ'}</span>`;
}

function getPriorityBadge(priority) {
  const map = {
    'ด่วนมาก': '<span class="badge pri-urgent">🔴 ด่วนมาก</span>',
    'ด่วน': '<span class="badge pri-high">🟡 ด่วน</span>',
    'ปกติ': '<span class="badge pri-normal">🟢 ปกติ</span>',
  };
  return map[priority] || '<span class="badge pri-normal">🟢 ปกติ</span>';
}

function renderList() {
  const tbody = document.getElementById('listBody');
  const search = document.getElementById('searchInput').value.toLowerCase();

  const filtered = ticketData.filter(r =>
    (r.title || '').toLowerCase().includes(search) ||
    (r.location || '').toLowerCase().includes(search) ||
    (r.status || '').toLowerCase().includes(search) ||
    (r.asset_id || '').toLowerCase().includes(search) ||
    (r.reporter_name || '').toLowerCase().includes(search) ||
    (r.ticket_no || '').toLowerCase().includes(search) ||
    (r.category || '').toLowerCase().includes(search)
  );

  document.getElementById('list-count').textContent = `แสดง ${filtered.length} จาก ${ticketData.length} รายการ`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">ไม่พบข้อมูลแจ้งซ่อม</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const dateTxt = String(r.created_at || '').split(' ');
    const isAdmin = currentUser && currentUser.role === 'admin';
  const actionCol = isAdmin
    ? `<td style="text-align:center;padding:14px 16px;white-space:nowrap;">
        <button onclick="openUpdateModal('${r.id}')" style="padding:6px 10px;border-radius:7px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">✏️ อัปเดต</button>
        <button onclick="deleteTicket('${r.id}')" style="padding:6px 10px;border-radius:7px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);color:#f87171;font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">🗑️ ลบ</button>
      </td>`
    : `<td style="text-align:center;padding:14px 16px;"><button onclick="openUpdateModal('${r.id}')" style="padding:6px 12px;border-radius:7px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">✏️ อัปเดต</button></td>`;

    return `<tr>
      <td style="padding:14px 16px;">
        <div style="font-size:12px;color:var(--text-primary);">${dateTxt[0] || '-'}</div>
        <div style="font-size:11px;color:var(--text-muted);">${r.ticket_no || ''}</div>
      </td>
      <td style="padding:14px 16px;">
        <div style="font-size:13px;font-weight:600;color:#e2eaf7;">${r.location || '-'}</div>
        <span class="chip">${r.asset_id || '-'}</span>
      </td>
      <td style="padding:14px 16px;max-width:260px;">
        <div style="font-size:13px;color:#e2eaf7;white-space:normal;line-height:1.4;">${r.title || '-'}</div>
        ${renderThumbs(r)}
        <div style="margin-top:${thumbsOf(r) ? '6px' : '4px'};display:flex;gap:4px;flex-wrap:wrap;">
          <span class="chip" style="background:rgba(124,58,237,0.08);color:rgba(168,85,247,0.8);border-color:rgba(124,58,237,0.15);">${r.category || '-'}</span>
          <span class="chip" style="background:rgba(0,212,255,0.04);color:var(--text-muted);">👤 ${r.reporter_name || '-'}</span>
        </div>
      </td>
      <td style="text-align:center;padding:14px 16px;">${getPriorityBadge(r.priority)}</td>
      <td style="text-align:center;padding:14px 16px;">${getStatusBadge(r.status)}</td>
      ${actionCol}
    </tr>`;
  }).join('');
}

// ===== Update Modal =====
function cPhotos(r) { return (Array.isArray(r.photos) && r.photos.length) ? r.photos : (r.photo_url ? [r.photo_url] : []); }
function dPhotos(r) { return Array.isArray(r.photos_done) ? r.photos_done : []; }
function thumbsOf(r) { return cPhotos(r).length + dPhotos(r).length; }
function renderThumbs(r) {
  const c = cPhotos(r).slice(0, 5);
  const d = dPhotos(r).slice(0, 5);
  if (!c.length && !d.length) return '';
  const thumb = (u, extra) => `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="รูปแนบ" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.15);${extra || ''}" title="เปิดรูปแนบ"></a>`;
  const cHtml = c.length ? `<div style="display:flex;gap:5px;align-items:center;">${c.slice(0, 3).map(u => thumb(u)).join('')}${c.length > 3 ? `<span style="font-size:11px;color:var(--text-muted);">+${c.length - 3}</span>` : ''}</div>` : '';
  const dHtml = d.length ? `<div style="display:flex;gap:5px;align-items:center;margin-top:4px;">${d.slice(0, 3).map(u => thumb(u, 'border-color:rgba(79,214,154,0.55);')).join('')}${d.length > 3 ? `<span style="font-size:11px;color:var(--text-muted);">+${d.length - 3}</span>` : ''}<span style="font-size:10px;color:var(--green);border:1px solid rgba(79,214,154,0.45);padding:1px 6px;border-radius:999px;margin-left:2px;">ผลงาน</span></div>` : '';
  return `<div style="margin-top:6px;">${cHtml}${dHtml}</div>`;
}

function selectStatus(s) {
  document.getElementById('u_status').value = s;
  const classes = ['wait', 'doing', 'parts', 'out', 'done'];
  classes.forEach(c => {
    document.getElementById(`pill-${c}`).className = `status-pill${s === mapStatus(c) ? ' sel-' + c : ''}`;
  });
}
function mapStatus(code) {
  const m = { wait: 'รอดำเนินการ', doing: 'กำลังซ่อม', parts: 'รออะไหล่', out: 'ส่งซ่อมภายนอก', done: 'เสร็จสิ้น' };
  return m[code];
}

function openUpdateModal(id) {
  const r = ticketData.find(x => String(x.id) === String(id));
  if (!r) return;
  document.getElementById('u_id').value = id;
  document.getElementById('u_technician').value = (r.technician && r.technician !== '-') ? r.technician : '';
  document.getElementById('u_cost').value = r.cost || 0;
  document.getElementById('u_notes').value = r.notes || '';
  selectStatus(r.status || 'รอดำเนินการ');

  // รูปตอนแจ้ง
  const disp = document.getElementById('u_photoDisplay');
  const c = cPhotos(r);
  disp.innerHTML = c.length
    ? c.map(u => `<img src="${u}" alt="รูปตอนแจ้ง" style="max-width:86px;max-height:86px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;" onclick="window.open('${u}','_blank')" title="เปิดรูปขยาย">`).join('') +
      `<span style="font-size:12px;color:var(--text-muted);align-self:center;">(${c.length} รูป)</span>`
    : `<span style="font-size:12px;color:var(--text-muted);">ยังไม่มีรูปตอนแจ้ง</span>`;

  // รูปตอนเสร็จ / ผลงาน
  const ddisp = document.getElementById('u_photoDoneDisplay');
  const d = dPhotos(r);
  ddisp.innerHTML = d.length
    ? d.map(u => `<img src="${u}" alt="รูปผลงาน" style="max-width:86px;max-height:86px;object-fit:cover;border-radius:8px;border:2px solid rgba(79,214,154,0.55);cursor:pointer;" onclick="window.open('${u}','_blank')" title="เปิดรูปขยาย">`).join('') +
      `<span style="font-size:12px;color:var(--green);align-self:center;">(${d.length} รูป)</span>`
    : `<span style="font-size:12px;color:var(--text-muted);">ยังไม่มีรูปตอนเสร็จ</span>`;

  ['u_photoFile', 'u_photoDoneFile'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('u_photoRemove').checked = false;
  document.getElementById('u_photoDoneRemove').checked = false;
  clearUPhotoPreview();
  clearUPhotoDonePreview();

  document.getElementById('updateModal').style.display = 'flex';
}

let uPhotoPreviews = [], uPhotoDonePreviews = [];

function buildPhotoPreviews(fileList, box, store) {
  const files = Array.from(fileList || []).slice(0, 5);
  box.innerHTML = '';
  store.length = 0;
  if (!files.length) { box.style.display = 'none'; return; }
  files.forEach((file, i) => {
    const rd = new FileReader();
    rd.onload = e => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;';
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'max-width:100px;max-height:100px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.15);';
      const rm = document.createElement('button');
      rm.type = 'button'; rm.textContent = '✕'; rm.title = 'เอารูปออก';
      rm.style.cssText = 'position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#11161f;border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:11px;cursor:pointer;line-height:1;';
      rm.onclick = () => rebuildPhotos(box, store, i);
      wrap.appendChild(img); wrap.appendChild(rm);
      box.appendChild(wrap);
    };
    rd.readAsDataURL(file);
    store.push({ file });
  });
  box.style.display = 'flex';
}

function rebuildPhotos(box, store, idx) {
  store.splice(idx, 1);
  buildPhotoPreviews(store.map(s => s.file), box, store);
}

function clearUPhotoPreview() {
  const box = document.getElementById('u_photoPreview');
  uPhotoPreviews = [];
  box.innerHTML = '';
  box.style.display = 'none';
  document.getElementById('u_photoFile').value = '';
  document.getElementById('u_photoRemove').checked = false;
}
function clearUPhotoDonePreview() {
  const box = document.getElementById('u_photoDonePreview');
  uPhotoDonePreviews = [];
  box.innerHTML = '';
  box.style.display = 'none';
  document.getElementById('u_photoDoneFile').value = '';
  document.getElementById('u_photoDoneRemove').checked = false;
}

function closeUpdateModal() { document.getElementById('updateModal').style.display = 'none'; }

document.addEventListener('DOMContentLoaded', () => {
  const uf = document.getElementById('u_photoFile');
  if (uf) uf.addEventListener('change', function () {
    buildPhotoPreviews(this.files, document.getElementById('u_photoPreview'), uPhotoPreviews);
    document.getElementById('u_photoRemove').checked = false;
    document.getElementById('u_photoCount').textContent = this.files.length
      ? `เลือกรูปตอนแจ้งใหม่ ${Math.min(this.files.length, 5)}/5 (จะแทนชุดเดิมทั้งหมด)`
      : '';
  });
  const df = document.getElementById('u_photoDoneFile');
  if (df) df.addEventListener('change', function () {
    buildPhotoPreviews(this.files, document.getElementById('u_photoDonePreview'), uPhotoDonePreviews);
    document.getElementById('u_photoDoneRemove').checked = false;
    document.getElementById('u_photoDoneCount').textContent = this.files.length
      ? `เลือกรูปผลงานใหม่ ${Math.min(this.files.length, 5)}/5 (จะแทนชุดเดิมทั้งหมด)`
      : '';
  });
});

async function saveUpdate() {
  const btn = document.getElementById('updateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังบันทึก...';

  const id = document.getElementById('u_id').value;
  const payload = {
    status: document.getElementById('u_status').value,
    technician: document.getElementById('u_technician').value.trim() || '-',
    cost: Number(document.getElementById('u_cost').value) || 0,
    notes: document.getElementById('u_notes').value.trim()
  };

  try {
    // รูปตอนแจ้ง: ไฟล์ใหม่ = แทนชุด, เช็กลบ = ล้างชุด, ไม่ทำ = เก็บเดิม
    const cFile = document.getElementById('u_photoFile');
    if (cFile.files && cFile.files.length) {
      const formData = new FormData();
      Array.from(cFile.files).slice(0, 5).forEach(f => formData.append('photos', f));
      const up = await API.upload('/api/upload', formData);
      payload.photos = up.urls || [];
    } else if (document.getElementById('u_photoRemove').checked) {
      payload.photos = [];
    }
    // รูปตอนเสร็จ/ผลงาน
    const dFile = document.getElementById('u_photoDoneFile');
    if (dFile.files && dFile.files.length) {
      const formData = new FormData();
      Array.from(dFile.files).slice(0, 5).forEach(f => formData.append('photos', f));
      const up = await API.upload('/api/upload', formData);
      payload.photos_done = up.urls || [];
    } else if (document.getElementById('u_photoDoneRemove').checked) {
      payload.photos_done = [];
    }

    await API.put(`/api/tickets/${id}`, payload);
    closeUpdateModal();
    showModal('อัปเดตสำเร็จ', 'บันทึกสถานะและอัปเดตเรียบร้อยแล้ว');
    loadTickets();
    loadDashboard();
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'บันทึก';
  }
}

function filterAndGoTo(status) {
  document.getElementById('searchInput').value = status === 'all' ? '' : status;
  switchTab('list');
  renderList();
}

function goBackHome() {
  document.getElementById('searchInput').value = '';
  switchTab('dashboard');
}

async function deleteTicket(id) {
  const r = ticketData.find(x => String(x.id) === String(id));
  if (!r) return;
  const ok = confirm(`ลบงาน ${r.ticket_no || ''} (${r.title || ''})?\nการลบไม่สามารถย้อนกลับได้`);
  if (!ok) return;
  try {
    await API.del(`/api/tickets/${id}`);
    showModal('ลบสำเร็จ', `ลบงาน ${r.ticket_no || ''} ออกจากระบบแล้ว`);
    loadTickets();
    loadDashboard();
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}
