// ==========================================
//  DASHBOARD
// ==========================================
let charts = {};
const MONTH_LABELS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const LOCATION_COLORS = ['#0066ff','#00d4ff','#f5a623','#22d474','#ff4d6d','#a855f7','#00e5c4','#fb923c'];

async function loadDashboard() {
  setSyncStatus('loading');
  try {
    const res = await API.get('/api/dashboard');
    renderDashboard(res);
    setSyncStatus('ok');
  } catch (err) {
    setSyncStatus('error');
  }
}

function renderDashboard(data) {
  const statuses = data.statuses;
  const total = data.total;

  const cards = [
    { label: 'ทั้งหมด', filter: 'all', val: total, tag: '📋 รายการ', color: 'var(--accent2)', bleft: '3px solid var(--accent2)' },
    { label: 'รอดำเนินการ', filter: 'รอดำเนินการ', val: statuses['รอดำเนินการ'], tag: '⏳ รายการ', color: 'var(--yellow)', bleft: '3px solid var(--yellow)' },
    { label: 'กำลังซ่อม', filter: 'กำลังซ่อม', val: statuses['กำลังซ่อม'], tag: '🔧 รายการ', color: 'var(--teal)', bleft: '3px solid var(--teal)' },
    { label: 'รออะไหล่', filter: 'รออะไหล่', val: statuses['รออะไหล่'], tag: '📦 รายการ', color: 'var(--purple)', bleft: '3px solid var(--purple)' },
    { label: 'ส่งซ่อมภายนอก', filter: 'ส่งซ่อมภายนอก', val: statuses['ส่งซ่อมภายนอก'], tag: '📤 รายการ', color: 'var(--orange)', bleft: '3px solid var(--orange)' },
    { label: 'เสร็จสิ้น', filter: 'เสร็จสิ้น', val: statuses['เสร็จสิ้น'], tag: '✅ รายการ', color: 'var(--green)', bleft: '3px solid var(--green)' },
  ];

  document.getElementById('stat-cards').innerHTML = cards.map(c => `
    <div class="glass stat-card" onclick="filterAndGoTo('${c.filter}')" style="border-left:${c.bleft};">
      <div class="stat-glow" style="background:${c.color};"></div>
      <div class="stat-label">${c.label}</div>
      <div class="stat-value" style="color:${c.color};}">${c.val}</div>
      <div class="stat-tag" style="color:${c.color};">${c.tag}</div>
    </div>
  `).join('');

  // Category chart
  const byCategory = data.byCategory || [];
  drawChart('chartCategory', 'doughnut',
    byCategory.map(r => r.category),
    byCategory.map(r => r.count),
    ['#0066ff','#00d4ff','#7c3aed','#f5a623','#00e5c4','#22d474','#ff4d6d']
  );

  // Location cost chart
  const byLocation = data.byLocation || [];
  drawChart('chartLocation', 'bar',
    byLocation.map(r => r.location),
    byLocation.map(r => Number(r.total_cost) || 0),
    ['rgba(0,212,255,0.7)']
  );

  // Monthly cost chart
  renderMonthlyCostChart(data.monthlyCost || []);

  // Tech stats
  renderTechTable(data.techStats || []);
}

function renderMonthlyCostChart(monthlyData) {
  const monthlyCost = Array(12).fill(0);
  const monthlyCount = Array(12).fill(0);
  (monthlyData || []).forEach(r => {
    const m = Number(r.month) - 1;
    if (m >= 0 && m < 12) {
      monthlyCost[m] = Number(r.total_cost) || 0;
      monthlyCount[m] = Number(r.count) || 0;
    }
  });

  const totalCost = monthlyCost.reduce((a,b) => a+b, 0);
  const totalCount = monthlyCount.reduce((a,b) => a+b, 0);

  document.getElementById('monthlySummaryRow').innerHTML = `
    <div class="glass" style="padding:12px 14px;text-align:center;">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">รวมทั้งปี</div>
      <div style="font-size:18px;font-weight:800;color:var(--yellow);">฿${totalCost.toLocaleString()}</div>
    </div>
    <div class="glass" style="padding:12px 14px;text-align:center;">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">จำนวนงานซ่อม</div>
      <div style="font-size:18px;font-weight:800;color:var(--accent);">${totalCount} งาน</div>
    </div>
  `;

  const ctx = document.getElementById('chartMonthlyCost').getContext('2d');
  if (charts['monthly']) charts['monthly'].destroy();
  Chart.defaults.color = '#5a7399';
  Chart.defaults.font.family = 'Kanit';
  charts['monthly'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MONTH_LABELS_TH,
      datasets: [{
        label: 'ค่าใช้จ่าย (฿)',
        data: monthlyCost,
        backgroundColor: MONTH_LABELS_TH.map((_, i) => monthlyCost[i] > 0 ? 'rgba(245,166,35,0.65)' : 'rgba(45,64,96,0.3)'),
        borderColor: MONTH_LABELS_TH.map((_, i) => monthlyCost[i] > 0 ? 'rgba(245,166,35,1)' : 'rgba(45,64,96,0.4)'),
        borderWidth: 1.5,
        borderRadius: 7,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ค่าใช้จ่าย: ฿${Number(item.raw).toLocaleString()}`,
          }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,212,255,0.05)' }, ticks: { color: '#5a7399', font: { size: 11 }, callback: v => '฿' + v.toLocaleString() } },
        x: { grid: { display: false }, ticks: { color: '#5a7399', font: { size: 11 } } }
      }
    }
  });
}

function renderTechTable(techStats) {
  const tbody = document.getElementById('techBody');
  if (!techStats.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px;">ยังไม่มีข้อมูลช่าง</td></tr>`;
    return;
  }
  tbody.innerHTML = techStats.map(t => `
    <tr class="tech-row">
      <td style="padding:12px 16px;font-weight:600;color:#e2eaf7;">${escapeHtml(t.technician)}</td>
      <td style="padding:12px 16px;text-align:center;color:var(--yellow);">${t.pending}</td>
      <td style="padding:12px 16px;text-align:center;color:var(--teal);">${t.doing}</td>
      <td style="padding:12px 16px;text-align:center;color:var(--purple);">${t.waiting_parts}</td>
      <td style="padding:12px 16px;text-align:center;color:var(--orange);">${t.outsourced}</td>
      <td style="padding:12px 16px;text-align:center;color:var(--green);">${t.done}</td>
      <td style="padding:12px 16px;text-align:right;color:var(--red);font-weight:700;">฿${Number(t.total_cost).toLocaleString()}</td>
    </tr>`).join('');
}

function drawChart(id, type, labels, data, colors) {
  const ctx = document.getElementById(id).getContext('2d');
  if (charts[id]) charts[id].destroy();
  const isEmpty = !data.length;
  Chart.defaults.color = '#5a7399';
  Chart.defaults.font.family = 'Kanit';
  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels: isEmpty ? ['ไม่มีข้อมูล'] : labels,
      datasets: [{
        data: isEmpty ? [1] : data,
        backgroundColor: isEmpty ? ['rgba(45,64,96,0.4)'] : colors.map((c, i) => colors[i % colors.length]),
        borderWidth: type === 'doughnut' ? 2 : 0,
        borderColor: type === 'doughnut' ? 'rgba(6,11,20,0.8)' : undefined,
        borderRadius: type === 'bar' ? 6 : 0,
        hoverOffset: type === 'doughnut' ? 6 : 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: type === 'doughnut', position: 'right', labels: { padding: 12, font: { size: 11 }, boxWidth: 10 } } },
      scales: type === 'bar'
        ? { y: { beginAtZero: true, grid: { color: 'rgba(0,212,255,0.05)' }, ticks: { color: '#5a7399', font: { size: 11 } } }, x: { grid: { display: false }, ticks: { color: '#5a7399', font: { size: 11 } } } }
        : {}
    }
  });
}
