// ==========================================
//  TICKET FORM — สร้างงานแจ้งซ่อม
// ==========================================
let categoryList = [];
let locationList = [];
let technicianList = [];

async function loadConfigLists() {
  try {
    const [cats, locs, techs] = await Promise.all([
      API.get('/api/config/categories'),
      API.get('/api/config/locations'),
      API.get('/api/config/technicians')
    ]);
    categoryList = cats.categories;
    locationList = locs.locations;
    technicianList = techs.technicians;

    populateCategorySelect();
    populateLocationSelect();
    populateTechnicianSelects();
    renderAdminLists();
  } catch (err) {
    console.error('โหลด config ไม่สำเร็จ:', err);
  }
}

function populateCategorySelect() {
  const sel = document.getElementById('category');
  sel.innerHTML = '<option value="" disabled selected>เลือกหมวดหมู่</option>' +
    categoryList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function populateLocationSelect() {
  const sel = document.getElementById('location');
  sel.innerHTML = '<option value="" disabled selected>เลือกสถานที่</option>' +
    locationList.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
}

function populateTechnicianSelects() {
  const dl = document.getElementById('technician-datalist');
  if (dl) {
    dl.innerHTML = technicianList.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
  }
}

function onCategoryChange() {
  const val = document.getElementById('category').value;
  const wrap = document.getElementById('category-detail-wrap');
  const inp = document.getElementById('category-detail');
  const need = CATEGORY_NEEDS_DETAIL.includes(val);
  wrap.style.display = need ? 'block' : 'none';
  inp.required = need;
  if (!need) inp.value = '';
}

function onLocationChange() {
  const val = document.getElementById('location').value;
  const wrap = document.getElementById('location-detail-wrap');
  const inp = document.getElementById('location-detail');
  const need = LOCATION_NEEDS_DETAIL.includes(val);
  wrap.style.display = need ? 'block' : 'none';
  inp.required = need;
  if (!need) inp.value = '';
}

function getFinalCategory() {
  const val = document.getElementById('category').value;
  const detail = document.getElementById('category-detail').value.trim();
  if (CATEGORY_NEEDS_DETAIL.includes(val) && detail) return val + ' — ' + detail;
  return val;
}

function getFinalLocation() {
  const val = document.getElementById('location').value;
  const detail = document.getElementById('location-detail').value.trim();
  if (LOCATION_NEEDS_DETAIL.includes(val) && detail) return val + ' — ' + detail;
  return val;
}

let photoPreviews = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('repairForm').addEventListener('submit', handleSubmitForm);
  const pf = document.getElementById('photoFile');
  if (pf) pf.addEventListener('change', function () {
    renderPhotoPreviews(this.files);
  });
});

function renderPhotoPreviews(fileList) {
  const files = Array.from(fileList || []).slice(0, 5);
  const box = document.getElementById('photoPreview');
  const count = document.getElementById('photoCount');
  photoPreviews = [];
  box.innerHTML = '';

  if (!files.length) {
    box.style.display = 'none';
    count.textContent = 'เลือกได้สูงสุด 5 รูป';
    return;
  }

  files.forEach((file, i) => {
    const rd = new FileReader();
    rd.onload = e => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;';
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'max-width:120px;max-height:120px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,0.15);';
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '✕';
      rm.title = 'เอารูปออก';
      rm.style.cssText = 'position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#11161f;border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:11px;cursor:pointer;line-height:1;';
      rm.onclick = () => removePhotoPreview(i);
      wrap.appendChild(img);
      wrap.appendChild(rm);
      box.appendChild(wrap);
    };
    rd.readAsDataURL(file);
    photoPreviews.push({ file });
  });

  box.style.display = 'flex';
  count.textContent = `เลือกรูป ${files.length}/5`;
}

function removePhotoPreview(i) {
  photoPreviews.splice(i, 1);
  const pf = document.getElementById('photoFile');
  const dt = new DataTransfer();
  photoPreviews.forEach(p => dt.items.add(p.file));
  pf.files = dt.files;
  renderPhotoPreviews(pf.files);
}

function clearPhotoPreview() {
  document.getElementById('photoFile').value = '';
  photoPreviews = [];
  renderPhotoPreviews([]);
}

async function handleSubmitForm(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังบันทึก...';

  try {
    let photos = [];

    // Upload multiple photos (สูงสุด 5)
    const fileInput = document.getElementById('photoFile');
    if (fileInput.files && fileInput.files.length) {
      const formData = new FormData();
      Array.from(fileInput.files).slice(0, 5).forEach(f => formData.append('photos', f));
      const up = await API.upload('/api/upload', formData);
      photos = up.urls || [];
    }

    const payload = {
      category: getFinalCategory(),
      category_detail: document.getElementById('category').value,
      priority: document.getElementById('priority').value,
      location: getFinalLocation(),
      location_detail: document.getElementById('location').value,
      asset_id: document.getElementById('assetId').value.trim() || '-',
      title: document.getElementById('title').value,
      reporter_name: document.getElementById('reporterName').value.trim() || currentUser.name,
      photos
    };

    const res = await API.post('/api/tickets', payload);

    // Reset form
    this.reset();
    clearPhotoPreview();
    document.getElementById('category-detail-wrap').style.display = 'none';
    document.getElementById('location-detail-wrap').style.display = 'none';

    showModal('บันทึกสำเร็จ!', `งาน ${res.ticket.ticket_no} ถูกบันทึกและแจ้งเตือนอัตโนมัติ`);
    switchTab('list');
    loadTickets();
  } catch (err) {
    showModal('เกิดข้อผิดพลาด', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ บันทึกงานแจ้งซ่อม';
  }
}
