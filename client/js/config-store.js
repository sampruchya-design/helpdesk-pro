// ==========================================
//  CONFIG STORE — แหล่งข้อมูลกลางของ catalogs (หมวดหมู่/สถานที่/ช่าง)
//  ทั้ง ticket-form และ admin ใช้ผ่านนี้ → กำจัด global coupling + load-order dependency
// ==========================================
const ConfigStore = {
  categories: [],
  locations: [],
  technicians: [],
  _listeners: [],

  // ฟังเมื่อโหลด/refresh เสร็จ (populate selects, render admin lists …)
  onChange(fn) { this._listeners.push(fn); },

  _notify() { this._listeners.forEach(fn => fn()); },

  async load() {
    try {
      const [cats, locs, techs] = await Promise.all([
        API.get('/api/config/categories'),
        API.get('/api/config/locations'),
        API.get('/api/config/technicians')
      ]);
      this.categories = cats.categories;
      this.locations = locs.locations;
      this.technicians = techs.technicians;
      this._notify();
    } catch (err) {
      console.error('โหลด config ไม่สำเร็จ:', err);
    }
  }
};