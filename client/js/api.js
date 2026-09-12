// ==========================================
//  API HELPER — central fetch with token
// ==========================================
function authHeaders() {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const API = {
  async request(method, url, body, isForm) {
    const headers = authHeaders();

    let options = { method, headers };
    if (body) {
      if (isForm) {
        options.body = body;
      } else {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
    }

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    return data;
  },

  // ดาวน์โหลดไฟล์ (blob) — เช่น export/backup/PDF
  async download(url, filename, body) {
    const headers = authHeaders();
    const options = { method: 'GET', headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.method = 'POST';
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.message || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); },

  async upload(url, formData) {
    const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ==========================================
//  PHOTO PREVIEW — สร้างชุดภาพตัวอย่างจาก FileList (ใช้ที่ฟอร์มแจ้งซ่อม + อัปเดต)
//  จัด slot ตามลำดับ index ก่อน (กันภาพเลื่อนที่หลังโหลดไม่ทัน — BUG-12)
// ==========================================
function buildPhotoPreviewBox(fileList, box, store, { maxSize = 120, onRemove } = {}) {
  const files = Array.from(fileList || []).slice(0, 5);
  box.innerHTML = '';
  store.length = 0;
  if (!files.length) { box.style.display = 'none'; return 0; }

  files.forEach((file, i) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;';
    const img = document.createElement('img');
    img.style.cssText = `max-width:${maxSize}px;max-height:${maxSize}px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,0.15);`;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '✕';
    rm.title = 'เอารูปออก';
    rm.style.cssText = 'position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#11161f;border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:11px;cursor:pointer;line-height:1;';
    rm.onclick = () => onRemove && onRemove(i);
    wrap.appendChild(img);
    wrap.appendChild(rm);
    box.appendChild(wrap);
    store.push({ file, img });
  });

  // อ่านภาพทีละใบ → ใส่ลง slot ที่จองไว้ตาม index ไม่ใช่ลำดับที่โหลดเสร็จ
  store.forEach((item, i) => {
    if (!item.file) return;
    const rd = new FileReader();
    rd.onload = e => { if (item.img) item.img.src = e.target.result; };
    rd.readAsDataURL(item.file);
  });

  box.style.display = 'flex';
  return files.length;
}

// 로그인 유지
function getCurrentUser() {
  try {
    const u = localStorage.getItem('currentUser');
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}
