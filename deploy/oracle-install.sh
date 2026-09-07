#!/usr/bin/env bash
# ============================================================
#  HelpdeskPro — ติดตั้งบน Oracle Cloud Always Free VM
#  (Ubuntu 22.04/24.04, 1 OCPU ARM, ฟรีถาวร, disk ถาวร เก็บข้อมูลได้จริง)
#
#  วิธีใช้ (รันใน VM):
#    1) สร้าง VM ฟรีที่ https://cloud.oracle.com → Compute → Instances
#    2) ssh เข้า VM แล้วรัน:  sudo bash /path/of/install.sh  <repo-url>
#  หรือรันทีละคำสั่งตามหัวข้อ
# ============================================================
set -euo pipefail

REPO_URL="${1:-https://github.com/YOUR_USERNAME/helpdesk-pro.git}"
APP_DIR=/opt/helpdesk-pro

echo "==> 1/5 ติดตั้ง Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

echo "==> 2/5 ดาวน์โหลดโค้ด (app อยู่ที่ $APP_DIR)"
sudo mkdir -p "$APP_DIR"
sudo git clone "$REPO_URL" "$APP_DIR" || { echo "clone ซ้ำ -> git pull"; cd "$APP_DIR" && sudo git pull; }
cd "$APP_DIR"
sudo npm install --omit=dev

echo "==> 3/5 ตั้งค่า .env"
if [ ! -f "$APP_DIR/.env" ]; then
  sudo cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "!!!!! แก้ไฟล์ $APP_DIR/.env ให้ครบ (JWT_SECRET, LINE...) ก่อน start !!!!!"
fi

echo "==> 4/5 ติดตั้ง systemd service"
sudo cp "$APP_DIR/deploy/helpdeskpro.service" /etc/systemd/system/
sudo sed -i "s|/opt/helpdesk-pro|$APP_DIR|g" /etc/systemd/system/helpdeskpro.service
sudo systemctl daemon-reload
sudo systemctl enable helpdeskpro

echo "==> 5/5 เปิด firewall && เริ่ม service"
sudo ufw allow 3000/tcp || true
sudo systemctl restart helpdeskpro

echo ""
echo "✅ เสร็จแล้ว"
echo "   เข้าเว็บ:  http://<public-ip>:3000"
echo "   ตรวจ/log: sudo journalctl -u helpdeskpro -f"
echo "   ใช้โดเมน/https ฟรี: ติดตั้ง cloudflared tunnel (ดู README)"