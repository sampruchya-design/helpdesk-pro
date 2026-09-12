// ==========================================
//  KM LIBRARY — ห้องสมุด KM (Knowledge Management)
//  รายการ / อัปโหลด / ลบ / Export PDF / บันทึกผลวิเคราะห์เป็น KM
// ==========================================
let kmData = [];
let kmCategories = [];

async function loadKMs() {
  const grid = document.getElementById('km-grid');
  grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;">⏳ กำลังโหลด...</p>';
  try {
    const res = await API.get('/api/kms');
    kmData = res.kms || [];
    // เก็บหมวดหมู่ทั้งหมดจากผลลัพธ์ (ทุกหน้า) + ดึงจาก categories endpoint
    kmCategories = [...new Set(kmData.map(k => (k.category || '').trim()).filter(Boolean))];
    try {
      const c = await API.get('/api/kms/categories');
      if (c.categories && c.categories.length) kmCategories = c.categories;
    } catch (e) {}
    fillKMCategoryFilter();
    renderKMs();
  } catch (err) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#f87171;">❌ ${err.message}</p>`;
  }
}

function fillKMCategoryFilter() {
  const sel = document.getElementById('km_category_filter');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">📂 ทุกหมวดหมู่</option>' +
    kmCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (kmCategories.includes(cur)) sel.value = cur;
}

function applyKMFilters() {
  const q = (document.getElementById('km_search')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('km_category_filter')?.value || '';
  const list = kmData.filter(km => {
    const okCat = !cat || (km.category || '').trim().toLowerCase() === cat.toLowerCase();
    const okQ = !q || [km.title, km.symptom, km.content, km.location, km.operator, km.ticket_no, km.category]
      .some(v => String(v || '').toLowerCase().includes(q));
    return okCat && okQ;
  });
  const cnt = document.getElementById('km_result_count');
  if (cnt) cnt.textContent = list.length ? `พบ ${list.length} เอกสาร` : '';
  renderKMGrid(list);
}

function renderKMs() {
  fillKMCategoryFilter();
  applyKMFilters();
}

function renderKMGrid(rows) {
  const grid = document.getElementById('km-grid');
  if (!rows.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;">📭 ยังไม่มีเอกสาร KM — กดปุ่ม "เพิ่มเอกสาร KM" เพื่อสร้างใหม่</p>';
    return;
  }
  const isAdmin = currentUser && currentUser.role === 'admin';
  grid.innerHTML = rows.map(km => {
    const isAnalysis = km.source === 'analysis';
    const badge = isAnalysis
      ? '<span style="background:rgba(0,212,255,0.1);color:var(--accent);border:1px solid rgba(0,212,255,0.2);padding:2px 8px;border-radius:999px;font-size:10px;">🤖 ผลวิเคราะห์</span>'
      : '<span style="background:rgba(168,85,247,0.1);color:var(--purple);border:1px solid rgba(168,85,247,0.2);padding:2px 8px;border-radius:999px;font-size:10px;">📤 อัปโหลด</span>';
    const cover = km.file_url
      ? (/\.(png|jpe?g|gif|webp)$/i.test(km.file_url)
        ? `<img src="${km.file_url}" alt="cover" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;">`
        : `<div style="width:100%;height:140px;background:linear-gradient(135deg,#0b1220 0%,#1e293b 100%);display:flex;align-items:center;justify-content:center;border-radius:8px 8px 0 0;font-size:40px;">📄</div>`)
      : `<div style="width:100%;height:140px;background:linear-gradient(135deg,#0b1220 0%,#1e293b 100%);display:flex;align-items:center;justify-content:center;border-radius:8px 8px 0 0;"><span style="font-size:40px;">📚</span></div>`;
    const created = String(km.created_at || '').split(' ')[0] || '-';
    const sym = km.symptom && String(km.symptom).trim()
      ? `<div style="margin:6px 0 10px;font-size:12px;color:#fbbf24;line-height:1.4;"><span style="opacity:0.8;">🩺</span> ${escapeHtml(km.symptom)}</div>`
      : '';
    return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:transform 0.2s;" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='none'">
      ${cover}
      <div style="padding:14px;flex:1;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
          ${badge}
          <span style="background:rgba(255,255,255,0.04);color:var(--text-muted);padding:2px 8px;border-radius:999px;font-size:10px;">${escapeHtml(km.category || 'อื่นๆ')}</span>
          ${km.ticket_no ? `<span style="color:var(--accent);font-size:10px;">📋 ${escapeHtml(km.ticket_no)}</span>` : ''}
        </div>
        <h4 style="margin:0 0 2px;font-size:14px;font-weight:700;color:#e2eaf7;line-height:1.3;">${escapeHtml(km.title)}</h4>
        ${sym}
        <div style="font-size:11px;color:var(--text-muted);line-height:1.5;">
          ${km.location ? `📍 ${escapeHtml(km.location)} · ` : ''}${km.operator ? `👤 ${escapeHtml(km.operator)}` : ''}${km.created_by ? `<br>บันทึกโดย ${escapeHtml(km.created_by)}` : ''}
        </div>
        <div style="flex:1;"></div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          <button onclick="viewKM(${km.id})" style="flex:1;min-width:60px;padding:6px;border-radius:7px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">👁️ ดู</button>
          <button onclick="exportKMPdf(${km.id})" style="flex:1;min-width:60px;padding:6px;border-radius:7px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);color:var(--purple);font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">📤 PDF</button>
          ${isAdmin ? `<button onclick="deleteKM(${km.id})" style="padding:6px;border-radius:7px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);color:#f87171;font-size:11px;font-weight:700;cursor:pointer;font-family:'Kanit',sans-serif;">🗑️</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openKMForm() {
  ['km_title','km_ticket_no','km_category','km_symptom','km_location','km_operator','km_supervisor','km_content','km_tech','km_steps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('km_cover_file').value = '';
  document.getElementById('km_images').value = '';
  const pre = document.getElementById('km_image_preview');
  pre.innerHTML = '';
  pre.style.display = 'none';
  document.getElementById('kmModal').style.display = 'flex';
}
function closeKMModal() { document.getElementById('kmModal').style.display = 'none'; }

function viewKM(id) {
  const km = kmData.find(x => x.id === id);
  if (!km) return;
  const url = km.file_url && /\.pdf$/i.test(km.file_url)
    ? km.file_url
    : `/api/kms/${id}/pdf`;
  window.open(url, '_blank');
}

function exportKMPdf(id) {
  window.open(`/api/kms/${id}/pdf`, '_blank');
}

async function deleteKM(id) {
  if (!confirm('ต้องการลบเอกสาร KM นี้?')) return;
  try {
    await API.del(`/api/kms/${id}`);
    await loadKMs();
    showModal('ลบสำเร็จ', 'เอกสาร KM ถูกลบแล้ว');
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

async function saveKM() {
  const btn = document.getElementById('kmSaveBtn');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังบันทึก...';
  try {
    const formData = new FormData();
    formData.append('title', document.getElementById('km_title').value);
    formData.append('category', document.getElementById('km_category').value || 'อื่นๆ');
    formData.append('symptom', document.getElementById('km_symptom').value);
    formData.append('ticket_no', document.getElementById('km_ticket_no').value);
    formData.append('location', document.getElementById('km_location').value);
    formData.append('operator', document.getElementById('km_operator').value);
    formData.append('supervisor', document.getElementById('km_supervisor').value);
    formData.append('content', document.getElementById('km_content').value);
    formData.append('tech_info', document.getElementById('km_tech').value);
    formData.append('steps', document.getElementById('km_steps').value);

    // รูปปก
    const cover = document.getElementById('km_cover_file').files[0];
    if (cover) formData.append('files', cover);
    // รูปอื่นๆ
    const imgs = document.getElementById('km_images').files;
    Array.from(imgs).slice(0, 10).forEach(f => formData.append('files', f));

    const res = await fetch('/api/kms', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'บันทึกไม่สำเร็จ');

    closeKMModal();
    await loadKMs();
    showModal('บันทึกสำเร็จ!', data.message || 'เอกสาร KM ถูกบันทึกแล้ว');
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 บันทึก KM';
  }
}

// ===== AI Panel → KM =====
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function saveAiAsKM() {
  const insights = document.getElementById('aiInsights');
  const txt = (insights?.innerText || '').trim();
  if (!txt || txt === '⏳ กำลังวิเคราะห์ข้อมูล...' || txt.startsWith('❌')) {
    showModal('ยังไม่มีผลวิเคราะห์', 'กด 🔄 รีเฟรช วิเคราะห์ใหม่ก่อน');
    return;
  }
  const title = prompt('หัวข้อเอกสาร KM:', 'ผลวิเคราะห์ประจำเดือน ' + new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }));
  if (!title) return;
  const category = prompt('หมวดหมู่:', 'ผลวิเคราะห์/AI');
  const symptom = prompt('อาการเสีย (เช่น หมวดเครื่องปรับอากาศแจ้งซ่อมถี่):', '');
  try {
    const res = await API.post('/api/kms/from-analysis', {
      title,
      category: category || 'ผลวิเคราะห์/AI',
      symptom: symptom || '',
      content: txt.replace(/\n/g, '\n').split('•').map(s => s.trim()).filter(Boolean).join('\n'),
      created_by: currentUser?.name || 'AI'
    });
    await loadKMs();
    showModal('บันทึกสำเร็จ!', `ผลวิเคราะห์ถูกบันทึกเป็น KM แล้ว (${res.id})`);
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  }
}

async function exportAiAsPDF() {
  const insights = document.getElementById('aiInsights');
  const txt = (insights?.innerText || '').trim();
  if (!txt || txt === '⏳ กำลังวิเคราะห์ข้อมูล...' || txt.startsWith('❌')) {
    showModal('ยังไม่มีผลวิเคราะห์', 'กด 🔄 รีเฟรช วิเคราะห์ใหม่ก่อน');
    return;
  }
  try {
    const res = await fetch('/api/kms/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({
        title: 'ผลวิเคราะห์ ' + new Date().toLocaleDateString('th-TH'),
        category: 'ผลวิเคราะห์/AI',
        content: txt.split('•').map(s => s.trim()).filter(Boolean).join('\n')
      })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `KM_ผลวิเคราะห์_${new Date().toISOString().slice(0,10)}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    showModal('Export PDF ไม่สำเร็จ', err.message);
  }
}

// ===== Image preview in modal =====
document.addEventListener('DOMContentLoaded', () => {
  const imgInput = document.getElementById('km_images');
  if (imgInput) imgInput.addEventListener('change', function () {
    const pre = document.getElementById('km_image_preview');
    pre.innerHTML = '';
    if (!this.files.length) { pre.style.display = 'none'; return; }
    Array.from(this.files).slice(0, 10).forEach(file => {
      const rd = new FileReader();
      rd.onload = e => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.cssText = 'width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.15);';
        pre.appendChild(img);
      };
      rd.readAsDataURL(file);
    });
    pre.style.display = 'flex';
  });
});