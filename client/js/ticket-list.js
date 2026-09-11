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
function photosOf(r) {
  const arr = Array.isArray(r.photos) ? r.photos : (r.photo_url ? [r.photo_url] : []);
  return (arr || []).filter(Boolean).slice(0, 5);
}
function thumbsOf(r) { return photosOf(r).length; }
function renderThumbs(r) {
  const ph = photosOf(r);
  if (!ph.length) return '';
  return `<div style="margin-top:6px;display:flex;gap:5px;align-items:center;">
    ${ph.slice(0, 3).map(u => `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="รูปแนบ" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.15);" title="เปิดรูปแนบ"></a>`).join('')}
    ${ph.length > 3 ? `<span style="font-size:11px;color:var(--text-muted);">+${ph.length - 3}</span>` : ''}
  </div>`;
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

  // รูปภาพ
  const disp = document.getElementById('u_photoDisplay');
  const ph = photosOf(r);
  disp.innerHTML = ph.length
    ? ph.map(u => `<img src="${u}" alt="รูปเดิม" style="max-width:86px;max-height:86px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;" onclick="window.open('${u}','_blank')" title="เปิดรูปขยาย">`).join('') +
      `<span style="font-size:12px;color:var(--text-muted);align-self:center;">(${ph.length} รูป)</span>`
    : `<span style="font-size:12px;color:var(--text-muted);">ยังไม่มีรูป</span>`;
  document.getElementById('u_photoFile').value = '';
  document.getElementById('u_photoRemove').checked = false;
  clearUPhotoPreview();

  document.getElementById('updateModal').style.display = 'flex';
}

let uPhotoPreviews = [];
function clearUPhotoPreview() {
  const box = document.getElementById('u_photoPreview');
  uPhotoPreviews = [];
  box.innerHTML = '';
  box.style.display = 'none';
  document.getElementById('u_photoRemove').checked = false;
}

function closeUpdateModal() { document.getElementById('updateModal').style.display = 'none'; }

document.addEventListener('DOMContentLoaded', () => {
  const uf = document.getElementById('u_photoFile');
  if (uf) uf.addEventListener('change', function () {
    const files = Array.from(this.files || []).slice(0, 5);
    const box = document.getElementById('u_photoPreview');
    const count = document.getElementById('u_photoCount');
    box.innerHTML = '';
    uPhotoPreviews = [];
    if (!files.length) { box.style.display = 'none'; count.textContent = ''; document.getElementById('u_photoRemove').checked = false; return; }

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
        rm.onclick = () => removeUPhotoPreview(i);
        wrap.appendChild(img); wrap.appendChild(rm);
        box.appendChild(wrap);
      };
      rd.readAsDataURL(file);
      uPhotoPreviews.push({ file });
    });
    box.style.display = 'flex';
    document.getElementById('u_photoRemove').checked = false;
    count.textContent = `เลือกรูปใหม่ ${files.length}/5 (จะแทนชุดเดิมทั้งหมด)`;
  });
});

function removeUPhotoPreview(i) {
  uPhotoPreviews.splice(i, 1);
  const pf = document.getElementById('u_photoFile');
  const dt = new DataTransfer();
  uPhotoPreviews.forEach(p => dt.items.add(p.file));
  pf.files = dt.files;
  pf.dispatchEvent(new Event('change'));
}

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
    // รูปใหม่ (หลายรูป) / เอารูปเดิมออก / เก็บรูปเดิม
    const fileInput = document.getElementById('u_photoFile');
    if (fileInput.files && fileInput.files.length) {
      const formData = new FormData();
      Array.from(fileInput.files).slice(0, 5).forEach(f => formData.append('photos', f));
      const up = await API.upload('/api/upload', formData);
      payload.photos = up.urls || [];
    } else if (document.getElementById('u_photoRemove').checked) {
      payload.photos = [];
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
