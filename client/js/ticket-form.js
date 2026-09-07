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
  const sel = document.getElementById('u_technician');
  sel.innerHTML = '<option value="">-- เลือกช่าง --</option>' +
    technicianList.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('repairForm').addEventListener('submit', handleSubmitForm);
});

async function handleSubmitForm(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังบันทึก...';

  try {
    let photo_url = null;

    // Upload photo if present
    const fileInput = document.getElementById('photoFile');
    if (fileInput.files && fileInput.files[0]) {
      const formData = new FormData();
      formData.append('photo', fileInput.files[0]);
      const up = await API.upload('/api/upload', formData);
      photo_url = up.url;
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
      photo_url
    };

    const res = await API.post('/api/tickets', payload);

    // Reset form
    this.reset();
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
