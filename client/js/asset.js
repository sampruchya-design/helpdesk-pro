// ==========================================
//  ASSET — ประวัติทรัพย์สิน
// ==========================================
async function loadAssets() {
  try {
    const res = await API.get('/api/assets');
    renderAssets(res.assets);
  } catch (err) {
    console.error('โหลดทรัพย์สินไม่สำเร็จ:', err);
  }
}

function renderAssets(assets) {
  const tbody = document.getElementById('assetBody');

  if (!assets.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">ยังไม่มีข้อมูลทรัพย์สิน</td></tr>`;
    return;
  }

  tbody.innerHTML = assets.map(a => {
    const statusBadge = a.last_status === 'เสร็จสิ้น'
      ? `<span class="badge badge-done">✅ เสร็จสิ้น</span>`
      : a.last_status === 'กำลังซ่อม'
        ? `<span class="badge badge-doing">🔧 กำลังซ่อม</span>`
        : a.last_status === 'รออะไหล่'
          ? `<span class="badge badge-parts">📦 รออะไหล่</span>`
          : a.last_status === 'ส่งซ่อมภายนอก'
            ? `<span class="badge badge-out">📤 ส่งซ่อมภายนอก</span>`
            : a.last_status
              ? `<span class="badge badge-wait">⏳ รอดำเนินการ</span>`
              : `<span style="font-size:11px;color:var(--text-faint);">—</span>`;

    return `<tr>
      <td style="padding:14px 16px;font-weight:700;color:var(--accent);">${a.asset_key}</td>
      <td style="padding:14px 16px;text-align:center;"><span style="display:inline-block;padding:4px 14px;border-radius:20px;background:rgba(0,212,255,0.08);color:var(--accent);font-size:12px;font-weight:700;border:1px solid rgba(0,212,255,0.15);">${a.repair_count} ครั้ง</span></td>
      <td style="padding:14px 16px;text-align:center;">${statusBadge}</td>
      <td style="padding:14px 16px;text-align:right;font-weight:700;color:${Number(a.total_cost) > 0 ? 'var(--red)' : 'var(--text-muted)'};">฿${Number(a.total_cost).toLocaleString()}</td>
    </tr>`;
  }).join('');
}
