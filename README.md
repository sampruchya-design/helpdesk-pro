# 🔧 HelpdeskPro — ระบบแจ้งซ่อมและติดตามงาน

Web application สำหรับองค์กรเล็ก (8 คน) รองรับมือถือและคอมพิวเตอร์
ฐานข้อมูล: SQLite | Realtime: WebSocket | แจ้งเตือน: LINE + Telegram

## ✨ Features

- 📝 ฟอร์มแจ้งซ่อม (หมวดหมู่, สถานที่, ความสำคัญ, แนบรูป)
- 📋 รายการงานซ่อม + ค้นหา (5 สถานะ)
- 📊 Dashboard สถิติ + กราฟ Chart.js
- 🔍 ประวัติทรัพย์สินรายตัว
- 👨‍🔧 สรุปการทำงานของช่าง
- ⚙️ จัดการผู้ใช้/หมวดหมู่/สถานที่/ช่าง (Admin)
- 💾 Export CSV/JSON/TXT
- 🔔 แจ้งเตือน LINE + Telegram เมื่อมีงานใหม่/เปลี่ยนสถานะ
- ⏰ รายงานอัตโนมัติ: Daily 09:00 + Weekly (Fri) 16:00
- 📡 WebSocket realtime — อัปเดตทุกหน้าจอทันที
- ⏱️ SLA tracking (เวลาตั้งแต่แจ้ง → ช่างรับงาน)

## 🚀 Quick Start

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ตั้งค่า .env (แก้ JWT_SECRET, LINE tokens ตามต้องการ)
#    ไฟล์ .env ถูกสร้างไว้แล้ว — เปิดแก้ตามต้องการ

# 3. รัน server
npm start

# 4. เปิดเบราว์เซอร์
#    http://localhost:3000
```

## 🔑 Login (รหัสพนักงาน)

ระบบใช้ **รหัสพนักงาน** เข้าใช้งาน (ไม่ใช้ PIN แล้ว):

- พนักงาน: `00174`, `00235`, `01263`, `00357`, `01004`, `01339`, `01424`, `01440`
- แอดมิน (จัดการข้อมูลทั้งหมด): `admin` — ชื่อแสดง "Admin Admin"
- เปิด/ปิด เพิ่ม แก้ไขผู้ใช้ได้ที่เมนู "ผู้ดูแลระบบ"

> `server/data/database.db` ถูกสร้างอัตโนมัติครั้งแรก และseed ผู้ใช้ชุดนี้ให้เลย

## 🔔 ตั้งค่า LINE กลุ่ม (Optional)

1. สร้าง LINE Official Account (LINE@) ที่ https://developers.line.biz
2. สร้าง Messaging API Channel → เอา Channel Access Token + Channel Secret
3. เพิ่ม Bot ลงในกลุ่ม LINE ที่ต้องการ (หรือใช้ userId ของผู้ใช้เอง)
4. ตั้งค่าใน `.env`:
   ```
   LINE_CHANNEL_ACCESS_TOKEN=xxx
   LINE_CHANNEL_ID=xxx
   LINE_CHANNEL_SECRET=xxx
   LINE_GROUP_CHAT_ID=xxx
   ```

## 🤖 ตั้งค่า Telegram (Optional)

ตั้งค่าที่ **หน้าแอดมินในเว็บ** ได้เลย no need `.env`:

1. สร้าง Bot กับ **@BotFather** → เอา token
2. เพิ่ม Bot ลงในกลุ่ม
3. หากลุ่ม chat_id: ส่งข้อความเข้าแล้วเรียก
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. เมนู "ผู้ดูแลระบบ" → กล่อง "🤖 การแจ้งเตือน Telegram" → กรอก **Bot Token** + **Chat ID** → บันทึก → กด "ส่งข้อความทดสอบ"

## ⏰ Scheduled Reports

| รายงาน | เวลา | เนื้อหา |
|---|---|---|
| **Daily** | ทุกวัน 09:00 | งานใหม่, ค้าง, กำลังทำ, รออะไหล่, ส่งซ่อม, เสร็จ |
| **Weekly** | ทุกศุกร์ 16:00 | งานใหม่, เสร็จ, ค้าง, ค่าใช้จ่าย, ช่างยอดเยี่ยม, งานเกินเวลา |

ตั้งเวลาได้ใน `server/services/scheduler.js`

## 📁 โครงสร้าง

```
helpdesk-pro/
├── server/
│   ├── server.js          ← Entry point
│   ├── database.js        ← SQLite (sql.js)
│   ├── routes/            ← API: auth, tickets, dashboard, assets, upload
│   ├── services/          ← notification (LINE/TG) + scheduler
│   ├── middleware/        ← JWT auth
│   ├── data/database.db   ← SQLite file (auto-generate)
│   └── uploads/           ← ไฟล์รูปที่แนบ
├── client/
│   ├── index.html         ← SPA
│   ├── css/style.css
│   └── js/                ← app, auth, api, socket, dashboard, ticket-*, asset, admin
├── .env                   ← Secrets
└── package.json
```

## 🏠 Deploy (ฟรี)

### ตัวเลือก A: Oracle Cloud Always Free VM — แนะนำ ⭐
VM ฟรีถาวร (1 CPU ARM + ย่อมเสียง 200GB) disk ถาวร **เก็บฐานข้อมูลได้จริง** server ตื่นเสมอ

1. สมัคร https://cloud.oracle.com → ปุ่ม "Start for free" (ขอบัตรเครดิต**ยืนยันตัวตน** — ไม่เรียกเก็บ)
2. Compute → Create instance → เลือก **Ampere ARM** (1 OCPU, 1GB) + Ubuntu 22.04 → เปิด port 3000 ใน Security List
3. push โค้ดขึ้น GitHub แล้วใน VM รัน:
   ```bash
   sudo bash # วางสคริปต์ deploy/oracle-install.sh เป็น root
   ## หรือรันทีละคำสั่งในไฟล์ deploy/oracle-install.sh
   ```
4. แก้ `JWT_SECRET` + `LINE_*` ใน `/opt/helpdesk-pro/.env`
5. เข้าเว็บ `http://<public-ip>:3000`

### ตัวเลือก B: Render — free tier (ง่ายสุด แต่หลับเมื่อ idle + disk ชั่วคราว)
- push ขึ้น GitHub → https://render.com → New → **Blueprint** → เลือก repo (มี `render.yaml` แล้ว)
- ⚠️ free Render หลับ 15 นาทีไม่มีคนใช้ และข้อมูลหายถ้า instance ถูก restart
  → ก่อน restart ให้กด "💾 สำรองฐานข้อมูล" ในหน้าแอดมิน ดาวน์โหลด `.db` ไว้

### เปิดใช้อินเทอร์เน็ต/HTTPS ฟรี
- ติดตั้ง cloudflared แล้วรัน `cloudflared tunnel --url http://localhost:3000`
  → ได้ URL `https://xxx.trycloudflare.com` เข้าใช้ผ่านมือถือได้
- (แนะนำบัญชี cloudflare + named tunnel ถ้าจะใช้เป็นทางการ)

## 💾 Backup
- หน้าแอดมิน → "สำรองฐานข้อมูล" → ดาวน์โหลด `helpdeskpro-backup-<date>.db`
- เปิดไฟล์ `.db` ได้ด้วย DBeaver / DB Browser for SQLite

## 🧑‍💻 Dev

```bash
npm run dev   # auto-restart เมื่อแก้โค้ด
```