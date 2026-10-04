// ================= Util =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rp = (n) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);
const rupiah = (n) => 'Rp ' + rp(n);
const pct = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n || 0) + '%';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tgl = (s) => { if (!s) return '-'; const [y, m, d] = s.split('-'); return `${+d}-${BULAN[+m - 1]}-${y.slice(2)}`; };
const PALETTE = ['#0f6e56', '#e0912f', '#3b6fb6', '#c2453d', '#7a5bb5', '#2e9d9a', '#b8a12a', '#8c5a3c', '#d16ba5', '#5d7a65', '#4c4c8a', '#9aa35b'];
const JENIS_OBLIGASI = ['Sukuk Ritel', 'Sukuk Tabungan', 'Obligasi Negara Ritel', 'Savings Bond Ritel', 'Obligasi Korporasi', 'Sukuk Korporasi'];

const state = { me: null, view: 'dashboard', userId: null, master: {}, charts: [] };

async function api(url, opt = {}) {
  const res = await fetch(url, {
    method: opt.method || 'GET',
    headers: opt.body ? { 'Content-Type': 'application/json' } : {},
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Sesi berakhir'); }
  if (!res.ok) throw new Error(data.error || 'Gagal memproses permintaan');
  return data;
}
const withUser = (url) => (state.userId && state.me.role === 'admin' ? `${url}${url.includes('?') ? '&' : '?'}user_id=${state.userId}` : url);

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(t._h); t._h = setTimeout(() => (t.className = 'toast'), 2600);
}
const isAdmin = () => state.me?.role === 'admin';

// ================= Modal form =================
// fields: [{name,label,type,options:[{value,label}],value,required,step,half}]
function formModal(title, fields, onSubmit) {
  const dlg = $('#modal');
  $('#modalTitle').textContent = title;
  $('#modalError').textContent = '';
  let html = '', buf = [];
  const input = (f) => {
    const v = f.value ?? '';
    let ctl;
    if (f.type === 'select') {
      ctl = `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map((o) =>
        `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    } else {
      ctl = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''}
             ${f.list ? `list="${f.name}-list"` : ''} ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
      if (f.list) ctl += `<datalist id="${f.name}-list">${f.list.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
    }
    return `<label>${esc(f.label)}${ctl}</label>`;
  };
  fields.forEach((f) => {
    if (f.half) { buf.push(input(f)); if (buf.length === 2) { html += `<div class="row2">${buf.join('')}</div>`; buf = []; } }
    else { if (buf.length) { html += `<div class="row2">${buf.join('')}</div>`; buf = []; } html += input(f); }
  });
  if (buf.length) html += `<div class="row2">${buf.join('')}</div>`;
  $('#modalBody').innerHTML = html;

  const form = $('#modalForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try { await onSubmit(data); dlg.close(); } catch (err) { $('#modalError').textContent = err.message; }
  };
  $('#modalCancel').onclick = () => dlg.close();
  dlg.showModal();
  return $('#modalBody');
}

async function confirmDelete(what, fn) {
  if (!confirm(`Hapus ${what}?`)) return;
  try { await fn(); toast('Data dihapus'); render(); } catch (e) { toast(e.message, true); }
}

// ================= Auth & navigasi =================
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    state.me = await api('/api/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    e.target.reset();
    start();
  } catch (err) { $('#loginError').textContent = err.message; }
};
$('#btnLogout').onclick = async () => { await api('/api/logout', { method: 'POST' }); state.me = null; showLogin(); };
$('#btnPassword').onclick = () => formModal('Ganti kata sandi', [
  { name: 'lama', label: 'Kata sandi lama', type: 'password', required: true },
  { name: 'baru', label: 'Kata sandi baru (min. 6 karakter)', type: 'password', required: true },
], async (d) => { await api('/api/me/password', { method: 'POST', body: d }); toast('Kata sandi diperbarui'); });
$('#btnMenu').onclick = () => $('.sidebar').classList.toggle('open');

$$('#nav a').forEach((a) => a.onclick = () => { state.view = a.dataset.view; location.hash = state.view; $('.sidebar').classList.remove('open'); render(); });
$('#userPick').onchange = (e) => { state.userId = Number(e.target.value); render(); };

async function start() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#whoami').textContent = `${state.me.nama_lengkap || state.me.username} · ${state.me.role}`;
  $$('.admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin()));
  state.userId = state.me.id;
  if (isAdmin()) await loadUserPick();
  const h = location.hash.slice(1);
  if (h && $(`#nav a[data-view="${h}"]`)) state.view = h;
  render();
}
async function loadUserPick() {
  const users = await api('/api/users');
  $('#userPick').innerHTML = users.map((u) => `<option value="${u.id}" ${u.id === state.userId ? 'selected' : ''}>${esc(u.nama_lengkap || u.username)} (${esc(u.username)})</option>`).join('');
}
async function loadMaster() {
  const [jenis, lembaga, penyimpanan] = await Promise.all(['jenis', 'lembaga', 'penyimpanan'].map((t) => api('/api/master/' + t)));
  state.master = { jenis, lembaga, penyimpanan };
}

const TITLES = {
  dashboard: 'Dashboard', portofolio: 'Input Portofolio', obligasi: 'Obligasi', saham: 'Saham', crypto: 'Crypto', gaji: 'Gaji PNS', aruskas: 'Arus Kas',
  jenis: 'Jenis Instrumen Keuangan', lembaga: 'Nama Instrumen Keuangan', penyimpanan: 'Instrumen Investasi / Penyimpanan', users: 'Manajemen Pengguna',
};
async function render() {
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === state.view));
  $('#viewTitle').textContent = TITLES[state.view];
  $('.user-pick').classList.toggle('hidden', !isAdmin() || !['dashboard', 'portofolio', 'obligasi', 'saham', 'crypto', 'gaji', 'aruskas'].includes(state.view));
  state.charts.forEach((c) => c.destroy()); state.charts = [];
  const v = $('#view');
  v.innerHTML = '<div class="empty">Memuat…</div>';
  try {
    await loadMaster();
    await VIEWS[state.view](v);
  } catch (e) { v.innerHTML = `<div class="card error">${esc(e.message)}</div>`; }
}

// ================= Chart helper =================
function chart(canvas, type, labels, data, opts = {}) {
  const isRound = type === 'pie' || type === 'doughnut';
  const c = new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: Array.isArray(data[0]?.data) ? data : [{ data, backgroundColor: PALETTE, borderColor: '#fff', borderWidth: isRound ? 2 : 0, borderRadius: isRound ? 0 : 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: opts.horizontal ? 'y' : 'x',
      cutout: type === 'doughnut' ? '62%' : undefined,
      plugins: {
        legend: { display: !!(isRound || opts.legend), position: isRound ? 'right' : 'top', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => {
          const v = isRound ? ctx.parsed : (opts.horizontal ? ctx.parsed.x : ctx.parsed.y);
          if (isRound) { const sum = ctx.dataset.data.reduce((a, b) => a + b, 0); return ` ${ctx.label}: ${rupiah(v)} (${pct(v / sum * 100)})`; }
          return ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${rupiah(v)}`;
        } } },
      },
      scales: isRound ? {} : {
        [opts.horizontal ? 'x' : 'y']: { ticks: { callback: (v) => (v >= 1e6 ? rp(v / 1e6) + ' jt' : rp(v)) }, grid: { color: '#eef0eb' }, stacked: opts.stacked },
        [opts.horizontal ? 'y' : 'x']: { grid: { display: false }, stacked: opts.stacked },
      },
    },
  });
  state.charts.push(c);
  return c;
}
function emptyChart(el, msg = 'Belum ada data') { el.parentElement.innerHTML = `<div class="empty">${msg}</div>`; }

function summaryTable(rows, total, label) {
  if (!rows.length) return '<div class="empty">Belum ada data</div>';
  return `<div class="table-wrap"><table>
    <thead><tr><th>${label}</th><th class="num">Nilai (Rp)</th><th class="num">%</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr>
      <td class="bar-cell"><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${esc(r.label)}
        <div class="bar"><span style="width:${(r.total / total * 100).toFixed(1)}%;background:${PALETTE[i % PALETTE.length]}"></span></div></td>
      <td class="num">${rp(r.total)}</td><td class="num">${pct(r.total / total * 100)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td><td class="num">${rp(total)}</td><td class="num">100%</td></tr></tfoot>
  </table></div>`;
}

// ================= Views =================
const VIEWS = {};

// ---------- Dashboard ----------
VIEWS.dashboard = async (v) => {
  const [d, porto] = await Promise.all([api(withUser('/api/dashboard')), api(withUser('/api/portofolio'))]);
  const r = d.ringkas;
  v.innerHTML = `
  <div class="kpis">
    <div class="card kpi main"><div class="label">Total Aset</div><div class="value">${rupiah(r.totalAset)}</div><div class="sub">Portofolio + obligasi + saham + crypto</div></div>
    <div class="card kpi"><div class="label">Portofolio (bank, e-wallet, dll.)</div><div class="value">${rupiah(r.totalPorto)}</div><div class="sub">${porto.length} pos</div></div>
    <div class="card kpi"><div class="label">Obligasi aktif</div><div class="value">${rupiah(r.totalObl)}</div><div class="sub">${r.jumlahObl} seri · proyeksi ${rupiah(r.proyeksiObl)}</div></div>
    <div class="card kpi"><div class="label">Saham (nilai pasar)</div><div class="value">${rupiah(r.totalSaham)}</div>
      <div class="sub">${r.jumlahEmiten} emiten · <span class="${r.labaSaham < 0 ? 'neg' : 'pos'}">${r.labaSaham >= 0 ? '+' : ''}${rupiah(r.labaSaham)} (${pct(r.persenSaham)})</span></div></div>
    <div class="card kpi"><div class="label">Crypto (nilai pasar)</div><div class="value">${rupiah(r.totalCrypto)}</div>
      <div class="sub">${r.jumlahCrypto} aset · <span class="${r.labaCrypto < 0 ? 'neg' : 'pos'}">${r.labaCrypto >= 0 ? '+' : ''}${rupiah(r.labaCrypto)} (${pct(r.persenCrypto)})</span></div></div>
  </div>

  <div class="section-title">Ringkasan portofolio</div>
  <div class="grid-3">
    <div class="card"><h2>Komposisi aset</h2><div class="chart-box"><canvas id="cKomposisi"></canvas></div></div>
    <div class="card"><h2>Per jenis instrumen</h2><div class="chart-box"><canvas id="cJenis"></canvas></div></div>
    <div class="card"><h2>Per nama instrumen</h2><div class="chart-box"><canvas id="cLembaga"></canvas></div></div>
  </div>
  <div class="grid-3">
    <div class="card"><h2>Komposisi aset (termasuk obligasi & saham)</h2>${summaryTable(d.komposisi, r.totalAset, 'Instrumen')}</div>
    <div class="card"><h2>Per jenis instrumen</h2>${summaryTable(d.perJenis, r.totalPorto, 'Jenis')}</div>
    <div class="card"><h2>Per nama instrumen</h2>${summaryTable(d.perLembaga, r.totalPorto, 'Nama')}</div>
  </div>

  <div class="card"><h2>Detail portofolio<span class="spacer"></span><button class="btn sm" data-go="portofolio">Ubah data</button></h2>
    ${porto.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Jenis</th><th>Nama</th><th>Rekening / Kantong</th><th>Penyimpanan</th><th class="num">Nilai (Rp)</th><th class="num">%</th></tr></thead>
      <tbody>${porto.map((p) => `<tr><td>${esc(p.jenis)}</td><td>${esc(p.lembaga)}</td><td>${esc(p.nama_rekening || '-')}</td><td>${esc(p.penyimpanan)}</td>
        <td class="num">${rp(p.nilai)}</td><td class="num">${pct(r.totalPorto ? p.nilai / r.totalPorto * 100 : 0)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num">${rp(r.totalPorto)}</td><td class="num">100%</td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada data portofolio.</div>'}
  </div>

  <div class="section-title">Obligasi</div>
  <div class="grid-2">
    <div class="card"><h2>Saldo per jenis obligasi</h2><div class="chart-box"><canvas id="cOblJenis"></canvas></div></div>
    <div class="card"><h2>Saldo & proyeksi keuntungan per seri</h2><div class="chart-box"><canvas id="cOblSeri"></canvas></div></div>
  </div>
  <div class="card"><h2>Ringkasan per jenis obligasi</h2>
    ${d.oblPerJenis.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Jenis Obligasi</th><th class="num">Jumlah seri</th><th class="num">Saldo (Rp)</th><th class="num">Proyeksi keuntungan (Rp)</th><th class="num">%</th></tr></thead>
      <tbody>${d.oblPerJenis.map((o, i) => `<tr><td><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${esc(o.label)}</td>
        <td class="num">${o.jumlah}</td><td class="num">${rp(o.total)}</td><td class="num">${rp(o.proyeksi)}</td><td class="num">${pct(o.total / r.totalObl * 100)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${r.jumlahObl}</td><td class="num">${rp(r.totalObl)}</td><td class="num">${rp(r.proyeksiObl)}</td><td class="num">100%</td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada obligasi aktif.</div>'}
  </div>

  <div class="section-title">Saham</div>
  <div class="grid-2">
    <div class="card"><h2>Alokasi per emiten (nilai pasar)</h2><div class="chart-box"><canvas id="cSahamAlok"></canvas></div></div>
    <div class="card"><h2>Modal vs nilai pasar per emiten</h2><div class="chart-box"><canvas id="cSahamBanding"></canvas></div></div>
  </div>
  <div class="card"><h2>Ringkasan saham<span class="spacer"></span><button class="btn sm" data-go="saham">Ubah data</button></h2>
    ${d.sahamPerEmiten.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Kode</th><th>Emiten</th><th class="num">Lot</th><th class="num">Modal (Rp)</th><th class="num">Nilai pasar (Rp)</th><th class="num">Untung/Rugi (Rp)</th><th class="num">Return</th><th class="num">Alokasi</th></tr></thead>
      <tbody>${d.sahamPerEmiten.map((s, i) => `<tr><td><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span><b>${esc(s.label)}</b></td><td>${esc(s.emiten)}</td>
        <td class="num">${rp(s.lot)}</td><td class="num">${rp(s.modal)}</td><td class="num">${rp(s.total)}</td>
        <td class="num ${s.laba < 0 ? 'neg' : 'pos'}">${s.laba >= 0 ? '+' : ''}${rp(s.laba)}</td><td class="num ${s.laba < 0 ? 'neg' : 'pos'}">${pct(s.persen)}</td>
        <td class="num">${pct(s.total / r.totalSaham * 100)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${rp(r.modalSaham)}</td><td class="num">${rp(r.totalSaham)}</td>
        <td class="num ${r.labaSaham < 0 ? 'neg' : 'pos'}">${r.labaSaham >= 0 ? '+' : ''}${rp(r.labaSaham)}</td><td class="num">${pct(r.persenSaham)}</td><td class="num">100%</td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada data saham.</div>'}
  </div>

  <div class="section-title">Crypto</div>
  <div class="grid-2">
    <div class="card"><h2>Alokasi per aset (nilai pasar)</h2><div class="chart-box"><canvas id="cCryptoAlok"></canvas></div></div>
    <div class="card"><h2>Modal vs nilai pasar per aset</h2><div class="chart-box"><canvas id="cCryptoBanding"></canvas></div></div>
  </div>
  <div class="card"><h2>Ringkasan crypto<span class="spacer"></span><button class="btn sm" data-go="crypto">Ubah data</button></h2>
    ${d.cryptoPerAset.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Simbol</th><th>Nama Aset</th><th class="num">Jumlah</th><th class="num">Modal (Rp)</th><th class="num">Nilai Pasar (Rp)</th><th class="num">Untung/Rugi (Rp)</th><th class="num">Return</th><th class="num">Alokasi</th></tr></thead>
      <tbody>${d.cryptoPerAset.map((c, i) => `<tr><td><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span><b>${esc(c.label)}</b></td><td>${esc(c.nama)}</td>
        <td class="num">${rp(c.jumlah)}</td><td class="num">${rp(c.modal)}</td><td class="num">${rp(c.total)}</td>
        <td class="num ${c.laba < 0 ? 'neg' : 'pos'}">${c.laba >= 0 ? '+' : ''}${rp(c.laba)}</td><td class="num ${c.laba < 0 ? 'neg' : 'pos'}">${pct(c.persen)}</td>
        <td class="num">${pct(r.totalCrypto ? c.total / r.totalCrypto * 100 : 0)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${rp(r.modalCrypto)}</td><td class="num">${rp(r.totalCrypto)}</td>
        <td class="num ${r.labaCrypto < 0 ? 'neg' : 'pos'}">${r.labaCrypto >= 0 ? '+' : ''}${rp(r.labaCrypto)}</td><td class="num">${pct(r.persenCrypto)}</td><td class="num">100%</td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada data crypto.</div>'}
  </div>`;

  $$('[data-go]', v).forEach((b) => b.onclick = () => { state.view = b.dataset.go; render(); });

  const draw = (id, type, rows, opts) => {
    const el = $('#' + id);
    if (!rows.length) return emptyChart(el);
    chart(el, type, rows.map((x) => (x.label.length > 22 ? x.label.slice(0, 21) + '…' : x.label)), rows.map((x) => x.total), opts);
  };
  draw('cKomposisi', 'doughnut', d.komposisi);
  draw('cJenis', 'pie', d.perJenis);
  draw('cLembaga', 'bar', d.perLembaga.slice(0, 10), { horizontal: true });
  draw('cOblJenis', 'doughnut', d.oblPerJenis);

  const aktif = d.obligasi.filter((o) => o.status === 'Aktif');
  if (!aktif.length) emptyChart($('#cOblSeri'));
  else chart($('#cOblSeri'), 'bar', aktif.map((o) => o.kode), [
    { label: 'Saldo awal', data: aktif.map((o) => o.saldo_awal), backgroundColor: PALETTE[0], borderRadius: 4 },
    { label: 'Proyeksi keuntungan', data: aktif.map((o) => o.proyeksi), backgroundColor: PALETTE[1], borderRadius: 4 },
  ], { stacked: true, legend: true });

  draw('cSahamAlok', 'doughnut', d.sahamPerEmiten);
  if (!d.sahamPerEmiten.length) emptyChart($('#cSahamBanding'));
  else chart($('#cSahamBanding'), 'bar', d.sahamPerEmiten.map((s) => s.label), [
    { label: 'Modal', data: d.sahamPerEmiten.map((s) => s.modal), backgroundColor: '#b9c4bd', borderRadius: 4 },
    { label: 'Nilai pasar', data: d.sahamPerEmiten.map((s) => s.total), backgroundColor: PALETTE[0], borderRadius: 4 },
  ], { legend: true });

  draw('cCryptoAlok', 'doughnut', d.cryptoPerAset);
  if (!d.cryptoPerAset.length) emptyChart($('#cCryptoBanding'));
  else chart($('#cCryptoBanding'), 'bar', d.cryptoPerAset.map((c) => c.label), [
    { label: 'Modal', data: d.cryptoPerAset.map((c) => c.modal), backgroundColor: '#b9c4bd', borderRadius: 4 },
    { label: 'Nilai pasar', data: d.cryptoPerAset.map((c) => c.total), backgroundColor: PALETTE[0], borderRadius: 4 },
  ], { legend: true });
};

// ---------- Saham ----------
VIEWS.saham = async (v) => {
  const rows = await api(withUser('/api/saham'));
  const tot = (k) => rows.reduce((a, s) => a + s[k], 0);
  const laba = tot('nilai') - tot('modal');
  const cls = (n) => (n < 0 ? 'neg' : 'pos');
  const plus = (n) => (n >= 0 ? '+' : '');

  v.innerHTML = `<div class="card">
    <h2>Daftar saham<span class="spacer"></span><button class="btn primary sm" id="addSaham">+ Tambah saham</button></h2>
    <p class="hint">1 lot = 100 lembar. Modal = lot × 100 × harga beli; nilai pasar = lot × 100 × harga terkini. Ketik harga terkini langsung di tabel untuk memperbarui nilai (tersimpan otomatis).</p>
    ${rows.length ? `<div class="table-wrap"><table class="compact">
      <thead><tr><th>Kode / Emiten</th><th>Sekuritas</th><th>Tanggal Beli</th><th class="num">Lot</th><th class="num">Lembar</th>
        <th class="num">Harga Beli</th><th class="num" style="width:120px">Harga Terkini</th><th class="num">Modal</th><th class="num">Nilai Pasar</th>
        <th class="num">Untung/Rugi</th><th class="num">%</th><th></th></tr></thead>
      <tbody>${rows.map((s) => `<tr>
        <td><b>${esc(s.kode)}</b><div class="hint">${esc(s.emiten.replace(/\s*Tbk$/, ''))}</div></td><td>${esc(s.sekuritas || '-')}</td><td>${tgl(s.tanggal_beli)}</td>
        <td class="num">${rp(s.lot)}</td><td class="num">${rp(s.lembar)}</td><td class="num">${rp(s.harga_beli)}</td>
        <td class="num"><input class="harga-input" data-harga="${s.id}" inputmode="decimal" value="${s.harga_terkini > 0 ? rp(s.harga_terkini) : ''}" placeholder="${rp(s.harga_beli)}"></td>
        <td class="num">${rp(s.modal)}</td><td class="num">${rp(s.nilai)}</td>
        <td class="num ${cls(s.laba)}">${plus(s.laba)}${rp(s.laba)}</td><td class="num ${cls(s.laba)}">${pct(s.persen)}</td>
        <td class="actions"><button class="btn sm" data-edit="${s.id}">Ubah</button><button class="btn sm danger" data-del="${s.id}">Hapus</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total (${rows.length} transaksi)</td><td class="num">${rp(tot('lot'))}</td><td class="num">${rp(tot('lembar'))}</td><td colspan="2"></td>
        <td class="num">${rp(tot('modal'))}</td><td class="num">${rp(tot('nilai'))}</td>
        <td class="num ${cls(laba)}">${plus(laba)}${rp(laba)}</td><td class="num ${cls(laba)}">${pct(tot('modal') ? laba / tot('modal') * 100 : 0)}</td><td></td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada data saham.</div>'}
  </div>`;

  const parseNum = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
  $$('[data-harga]', v).forEach((inp) => inp.onchange = async () => {
    try { await api(`/api/saham/${inp.dataset.harga}/harga`, { method: 'PATCH', body: { harga_terkini: parseNum(inp.value) } }); toast('Harga diperbarui'); render(); }
    catch (e) { toast(e.message, true); }
  });

  const emiten = state.master.lembaga.filter((l) => l.jenis === 'Saham');
  const sekuritas = state.master.lembaga.filter((l) => l.jenis === 'Platform Investasi');
  const form = (s = {}) => formModal(s.id ? 'Ubah saham' : 'Tambah saham', [
    { name: 'emiten_id', label: 'Emiten', type: 'select', value: s.emiten_id, required: true,
      options: [{ value: '', label: '— pilih emiten —' }, ...emiten.map((l) => ({ value: l.id, label: `${l.singkatan} — ${l.nama}` }))] },
    { name: 'sekuritas_id', label: 'Sekuritas / aplikasi (opsional)', type: 'select', value: s.sekuritas_id,
      options: [{ value: '', label: '—' }, ...sekuritas.map((l) => ({ value: l.id, label: l.nama }))] },
    { name: 'tanggal_beli', label: 'Tanggal beli', type: 'date', value: s.tanggal_beli, half: true },
    { name: 'lot', label: 'Jumlah lot', type: 'number', step: '1', value: s.lot, required: true, half: true },
    { name: 'harga_beli', label: 'Harga beli rata-rata (Rp/lembar)', type: 'number', step: '0.01', value: s.harga_beli, required: true, half: true },
    { name: 'harga_terkini', label: 'Harga terkini (Rp/lembar)', type: 'number', step: '0.01', value: s.harga_terkini, half: true },
    { name: 'catatan', label: 'Catatan', value: s.catatan },
  ], async (d) => {
    if (s.id) await api('/api/saham/' + s.id, { method: 'PUT', body: d });
    else await api(withUser('/api/saham'), { method: 'POST', body: d });
    toast('Tersimpan'); render();
  });

  $('#addSaham').onclick = () => form();
  $$('[data-edit]', v).forEach((b) => b.onclick = () => form(rows.find((s) => s.id === Number(b.dataset.edit))));
  $$('[data-del]', v).forEach((b) => b.onclick = () => confirmDelete('saham ini', () => api('/api/saham/' + b.dataset.del, { method: 'DELETE' })));
};

// ---------- Crypto ----------
const CRYPTO_TOKENS = ['Bitcoin (BTC)', 'Ethereum (ETH)', 'BNB (BNB)', 'Solana (SOL)', 'XRP (XRP)', 'Cardano (ADA)',
  'Dogecoin (DOGE)', 'Polkadot (DOT)', 'Polygon (MATIC)', 'Avalanche (AVAX)', 'Chainlink (LINK)', 'Uniswap (UNI)',
  'Litecoin (LTC)', 'Toncoin (TON)', 'Tron (TRX)', 'Shiba Inu (SHIB)', 'Sui (SUI)', 'Pepe (PEPE)'];

VIEWS.crypto = async (v) => {
  const rows = await api(withUser('/api/crypto'));
  const tot = (k) => rows.reduce((a, c) => a + c[k], 0);
  const laba = tot('nilai') - tot('modal');
  const cls = (n) => (n < 0 ? 'neg' : 'pos');
  const plus = (n) => (n >= 0 ? '+' : '');

  v.innerHTML = `<div class="card">
    <h2>Daftar crypto<span class="spacer"></span><button class="btn primary sm" id="addCrypto">+ Tambah crypto</button></h2>
    <p class="hint">Modal = jumlah × harga beli; nilai pasar = jumlah × harga terkini. Ketik harga terkini langsung di tabel untuk memperbarui nilai (tersimpan otomatis).</p>
    ${rows.length ? `<div class="table-wrap"><table class="compact">
      <thead><tr><th>Aset</th><th>Exchange</th><th class="num">Jumlah</th>
        <th class="num">Harga Beli (Rp)</th><th class="num" style="width:130px">Harga Terkini (Rp)</th><th class="num">Modal</th><th class="num">Nilai Pasar</th>
        <th class="num">Untung/Rugi</th><th class="num">%</th><th></th></tr></thead>
      <tbody>${rows.map((c) => `<tr>
        <td><b>${esc(c.simbol)}</b><div class="hint">${esc(c.nama_aset)}</div></td><td>${esc(c.exchange || '-')}</td>
        <td class="num">${rp(c.jumlah)}</td><td class="num">${rp(c.harga_beli)}</td>
        <td class="num"><input class="harga-input" data-harga="${c.id}" inputmode="decimal" value="${c.harga_terkini > 0 ? rp(c.harga_terkini) : ''}" placeholder="${rp(c.harga_beli)}"></td>
        <td class="num">${rp(c.modal)}</td><td class="num">${rp(c.nilai)}</td>
        <td class="num ${cls(c.laba)}">${plus(c.laba)}${rp(c.laba)}</td><td class="num ${cls(c.laba)}">${pct(c.persen)}</td>
        <td class="actions"><button class="btn sm" data-edit="${c.id}">Ubah</button><button class="btn sm danger" data-del="${c.id}">Hapus</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total (${rows.length} aset)</td><td></td><td colspan="2"></td>
        <td class="num">${rp(tot('modal'))}</td><td class="num">${rp(tot('nilai'))}</td>
        <td class="num ${cls(laba)}">${plus(laba)}${rp(laba)}</td><td class="num ${cls(laba)}">${pct(tot('modal') ? laba / tot('modal') * 100 : 0)}</td><td></td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada data crypto.</div>'}
  </div>`;

  const parseNum = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
  $$('[data-harga]', v).forEach((inp) => inp.onchange = async () => {
    try { await api(`/api/crypto/${inp.dataset.harga}/harga`, { method: 'PATCH', body: { harga_terkini: parseNum(inp.value) } }); toast('Harga diperbarui'); render(); }
    catch (e) { toast(e.message, true); }
  });

  const exchanges = state.master.lembaga.filter((l) => l.jenis === 'Crypto');
  const form = (c = {}) => formModal(c.id ? 'Ubah crypto' : 'Tambah crypto', [
    { name: 'nama_aset', label: 'Nama aset', value: c.nama_aset, required: true, list: CRYPTO_TOKENS.map((t) => t.replace(/\s*\(.*\)/, '')), placeholder: 'Bitcoin' },
    { name: 'simbol', label: 'Simbol', value: c.simbol, required: true, placeholder: 'BTC' },
    { name: 'exchange_id', label: 'Exchange (opsional)', type: 'select', value: c.exchange_id,
      options: [{ value: '', label: '—' }, ...exchanges.map((l) => ({ value: l.id, label: l.nama }))] },
    { name: 'jumlah', label: 'Jumlah', type: 'number', step: 'any', value: c.jumlah, required: true, half: true },
    { name: 'harga_beli', label: 'Harga beli rata-rata (Rp)', type: 'number', step: '0.01', value: c.harga_beli, required: true, half: true },
    { name: 'harga_terkini', label: 'Harga terkini (Rp)', type: 'number', step: '0.01', value: c.harga_terkini, half: true },
    { name: 'catatan', label: 'Catatan', value: c.catatan },
  ], async (d) => {
    if (c.id) await api('/api/crypto/' + c.id, { method: 'PUT', body: d });
    else await api(withUser('/api/crypto'), { method: 'POST', body: d });
    toast('Tersimpan'); render();
  });

  $('#addCrypto').onclick = () => form();
  $$('[data-edit]', v).forEach((b) => b.onclick = () => form(rows.find((c) => c.id === Number(b.dataset.edit))));
  $$('[data-del]', v).forEach((b) => b.onclick = () => confirmDelete('crypto ini', () => api('/api/crypto/' + b.dataset.del, { method: 'DELETE' })));
};

// ---------- Gaji PNS ----------
const tglPanjang = (s) => {
  if (!s) return '-';
  const d = new Date(s + 'T00:00:00');
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
  return `${hari}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

VIEWS.gaji = async (v) => {
  const rows = await api(withUser('/api/gaji'));
  const latest = rows.length ? rows[rows.length - 1] : null;

  let slipHtml = '<div class="card"><h2>Slip Gaji Bulanan</h2><div class="empty">Belum ada data riwayat gaji. Tambahkan riwayat di bawah.</div></div>';
  if (latest) {
    const gp = latest.gaji_pokok;
    const tukin = latest.tunjangan_kinerja;
    const tunjab = latest.tunjangan_jabatan;
    const bruto = gp + tukin + tunjab;
    const bpjs = Math.round(gp * 0.01);
    const taspen = Math.round(gp * 0.08);
    const tapera = Math.round(gp * 0.025);
    const totalPot = bpjs + taspen + tapera;
    const netto = bruto - totalPot;

    const baris = (label, val, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="num">${rupiah(val)}</td></tr>`;

    slipHtml = `<div class="card">
      <h2>Slip Gaji Bulanan (estimasi)</h2>
      <p class="hint">Berdasarkan data terbaru: ${esc(latest.dokumen)} — ${tglPanjang(latest.tanggal)} (${esc(latest.status)})</p>
      <div class="table-wrap"><table class="compact slip-table">
        <thead><tr><th colspan="2" class="section-head pos">PENDAPATAN</th></tr></thead>
        <tbody>
          ${baris('Gaji Pokok', gp)}
          ${baris('Tunjangan Kinerja', tukin)}
          ${baris('Tunjangan Jabatan', tunjab)}
          <tr class="total"><td><b>Total Pendapatan (Bruto)</b></td><td class="num"><b>${rupiah(bruto)}</b></td></tr>
        </tbody>
        <thead><tr><th colspan="2" class="section-head neg">POTONGAN</th></tr></thead>
        <tbody>
          ${baris('BPJS Kesehatan (1% Gapok)', bpjs)}
          ${baris('Taspen — Pensiun & THT (8% Gapok)', taspen)}
          ${baris('Tapera (2,5% Gapok)', tapera)}
          <tr class="total"><td><b>Total Potongan</b></td><td class="num"><b>${rupiah(totalPot)}</b></td></tr>
        </tbody>
        <tfoot>
          <tr class="netto"><td><b>GAJI BERSIH (Take Home Pay)</b></td><td class="num"><b>${rupiah(netto)}</b></td></tr>
        </tfoot>
      </table></div>
    </div>`;
  }

  v.innerHTML = `${slipHtml}
  <div class="card">
    <h2>Riwayat Gaji & Karir<span class="spacer"></span><button class="btn primary sm" id="addGaji">+ Tambah</button></h2>
    <p class="hint">Catat setiap perubahan gaji: kenaikan berkala, penyesuaian, kenaikan pangkat, dll.</p>
    ${rows.length ? `<div class="table-wrap"><table class="compact">
      <thead><tr><th>No</th><th>Tanggal</th><th>Status</th><th>Dokumen / Keterangan</th>
        <th class="num">Gaji Pokok</th><th class="num">Tunj. Kinerja</th><th class="num">Tunj. Jabatan</th><th></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td>${i + 1}</td><td style="white-space:nowrap">${tglPanjang(r.tanggal)}</td><td>${esc(r.status)}</td><td>${esc(r.dokumen)}</td>
        <td class="num">${rp(r.gaji_pokok)}</td><td class="num">${rp(r.tunjangan_kinerja)}</td><td class="num">${rp(r.tunjangan_jabatan)}</td>
        <td class="actions"><button class="btn sm" data-edit="${r.id}">Ubah</button><button class="btn sm danger" data-del="${r.id}">Hapus</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">Belum ada data riwayat gaji.</div>'}
  </div>`;

  const form = (r = {}) => formModal(r.id ? 'Ubah riwayat' : 'Tambah riwayat', [
    { name: 'tanggal', label: 'Tanggal', type: 'date', value: r.tanggal, required: true, half: true },
    { name: 'status', label: 'Status', type: 'select', value: r.status || 'PNS',
      options: [{ value: 'PNS', label: 'PNS' }, { value: 'CPNS', label: 'CPNS' }], half: true },
    { name: 'dokumen', label: 'Dokumen / Keterangan', value: r.dokumen, required: true },
    { name: 'gaji_pokok', label: 'Gaji Pokok (Rp)', type: 'number', step: '1', value: r.gaji_pokok, required: true },
    { name: 'tunjangan_kinerja', label: 'Tunjangan Kinerja (Rp)', type: 'number', step: '1', value: r.tunjangan_kinerja, half: true },
    { name: 'tunjangan_jabatan', label: 'Tunjangan Jabatan (Rp)', type: 'number', step: '1', value: r.tunjangan_jabatan, half: true },
  ], async (d) => {
    if (r.id) await api('/api/gaji/' + r.id, { method: 'PUT', body: d });
    else await api(withUser('/api/gaji'), { method: 'POST', body: d });
    toast('Tersimpan'); render();
  });

  $('#addGaji').onclick = () => form();
  $$('[data-edit]', v).forEach((b) => b.onclick = () => form(rows.find((r) => r.id === Number(b.dataset.edit))));
  $$('[data-del]', v).forEach((b) => b.onclick = () => confirmDelete('riwayat gaji ini', () => api('/api/gaji/' + b.dataset.del, { method: 'DELETE' })));
};

// ---------- Arus Kas (estimasi pendapatan & pengeluaran bulanan) ----------
const KATEGORI_PENGELUARAN = [
  'Tempat Tinggal', 'Makanan & Minuman', 'Transportasi', 'Tagihan & Utilitas',
  'Cicilan & Pinjaman', 'Asuransi', 'Pendidikan', 'Kesehatan',
  'Hiburan & Gaya Hidup', 'Tabungan & Investasi', 'Lain-lain',
];

VIEWS.aruskas = async (v) => {
  const [gajiRows, oblRows, pengeluaranRows, dashData, pengaturan] = await Promise.all([
    api(withUser('/api/gaji')),
    api(withUser('/api/obligasi')),
    api(withUser('/api/pengeluaran')),
    api(withUser('/api/dashboard')),
    api(withUser('/api/pengaturan')),
  ]);

  const totalAset = dashData.ringkas.totalAset;

  const latest = gajiRows.length ? gajiRows[gajiRows.length - 1] : null;
  let gajiBruto = 0, gajiNetto = 0, gajiPokok = 0, tukin = 0, tunjab = 0, potGaji = 0;
  if (latest) {
    gajiPokok = latest.gaji_pokok;
    tukin = latest.tunjangan_kinerja;
    tunjab = latest.tunjangan_jabatan;
    gajiBruto = gajiPokok + tukin + tunjab;
    potGaji = Math.round(gajiPokok * 0.01) + Math.round(gajiPokok * 0.08) + Math.round(gajiPokok * 0.025);
    gajiNetto = gajiBruto - potGaji;
  }

  const aktifObl = oblRows.filter((o) => o.status === 'Aktif');
  const kuponBulanan = aktifObl.reduce((a, o) => a + (o.saldo_awal * (o.kupon / 100) / 12), 0);
  const kuponTahunan = aktifObl.reduce((a, o) => a + (o.saldo_awal * (o.kupon / 100)), 0);

  const totalPendapatanBulanan = gajiNetto + kuponBulanan;
  const totalPendapatanTahunan = (gajiNetto * 12) + kuponTahunan;

  const totalPengeluaran = pengeluaranRows.reduce((a, r) => a + r.jumlah, 0);
  const sisa = totalPendapatanBulanan - totalPengeluaran;

  const perKategori = Object.values(pengeluaranRows.reduce((acc, r) => {
    acc[r.kategori] ??= { kategori: r.kategori, total: 0 };
    acc[r.kategori].total += r.jumlah;
    return acc;
  }, {})).sort((a, b) => b.total - a.total);

  // Hitung bulan sejak pertama gajian
  const tglGaji = pengaturan.tanggal_pertama_gaji;
  let bulanKerja = 0, totalGajiKumulatif = 0, totalKuponKumulatif = 0, totalPendapatanKumulatif = 0;
  if (tglGaji) {
    const mulai = new Date(tglGaji + 'T00:00:00');
    const now = new Date();
    bulanKerja = (now.getFullYear() - mulai.getFullYear()) * 12 + (now.getMonth() - mulai.getMonth());
    if (now.getDate() < mulai.getDate()) bulanKerja--;
    if (bulanKerja < 0) bulanKerja = 0;
    totalGajiKumulatif = gajiNetto * bulanKerja;
    totalKuponKumulatif = kuponBulanan * bulanKerja;
    totalPendapatanKumulatif = totalPendapatanBulanan * bulanKerja;
  }
  const pertumbuhanAsetPerBulan = bulanKerja > 0 ? totalAset / bulanKerja : 0;
  const estimasiPengeluaranRiil = bulanKerja > 0 ? totalPendapatanBulanan - pertumbuhanAsetPerBulan : 0;

  const baris = (label, val, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="num">${rupiah(val)}</td></tr>`;

  v.innerHTML = `
  <div class="kpis">
    <div class="card kpi main"><div class="label">Total Aset (Acuan)</div><div class="value">${rupiah(totalAset)}</div><div class="sub">Portofolio + obligasi + saham + crypto</div></div>
    <div class="card kpi"><div class="label">Pendapatan / Bulan</div><div class="value">${rupiah(totalPendapatanBulanan)}</div><div class="sub">Gaji netto + kupon obligasi</div></div>
    <div class="card kpi"><div class="label">Pengeluaran / Bulan</div><div class="value">${rupiah(totalPengeluaran)}</div><div class="sub">${pengeluaranRows.length} pos pengeluaran</div></div>
    <div class="card kpi"><div class="label">Sisa (${sisa >= 0 ? 'Surplus' : 'Defisit'})</div><div class="value ${sisa >= 0 ? 'pos' : 'neg'}">${rupiah(sisa)}</div><div class="sub">${totalPendapatanBulanan ? pct(sisa / totalPendapatanBulanan * 100) + ' dari pendapatan' : '-'}</div></div>
  </div>

  <div class="grid-3">
    <div class="card"><h2>Pendapatan vs Pengeluaran</h2><div class="chart-box"><canvas id="cArusBar"></canvas></div></div>
    <div class="card"><h2>Komposisi Pendapatan</h2><div class="chart-box"><canvas id="cPendapatan"></canvas></div></div>
    <div class="card"><h2>Pengeluaran per Kategori</h2><div class="chart-box"><canvas id="cKategori"></canvas></div></div>
  </div>

  <div class="card">
    <h2>Tanggal Pertama Gajian</h2>
    <div class="toolbar">
      <label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px">Mulai menerima gaji sejak
        <input type="date" id="tglGajiInput" value="${esc(tglGaji || '')}" style="width:auto;margin:0">
      </label>
      <button class="btn sm primary" id="saveTglGaji">Simpan</button>
    </div>
    ${tglGaji ? `<div style="margin-top:14px">
      <div class="table-wrap"><table class="compact slip-table" style="max-width:100%">
        <tbody>
          <tr><td>Tanggal pertama gajian</td><td class="num"><b>${tglPanjang(tglGaji)}</b></td></tr>
          <tr><td>Lama bekerja</td><td class="num"><b>${Math.floor(bulanKerja / 12)} tahun ${bulanKerja % 12} bulan</b></td></tr>
          ${baris('Perkiraan total gaji diterima', totalGajiKumulatif)}
          ${baris('Perkiraan total kupon obligasi', totalKuponKumulatif)}
        </tbody>
        <tfoot>
          <tr class="netto"><td><b>PERKIRAAN TOTAL PENDAPATAN</b></td><td class="num"><b>${rupiah(totalPendapatanKumulatif)}</b></td></tr>
        </tfoot>
      </table></div>
      <div class="table-wrap" style="margin-top:14px"><table class="compact slip-table" style="max-width:100%">
        <thead><tr><th colspan="2" class="section-head pos">ANALISIS KEUANGAN</th></tr></thead>
        <tbody>
          ${baris('Total Aset saat ini', totalAset)}
          <tr><td>Lama bekerja</td><td class="num">${bulanKerja} bulan</td></tr>
          ${baris('Pertumbuhan aset / bulan', pertumbuhanAsetPerBulan)}
          ${baris('Pendapatan / bulan', totalPendapatanBulanan)}
        </tbody>
        <tfoot>
          <tr class="netto" style="${estimasiPengeluaranRiil > totalPendapatanBulanan * 0.7 ? 'background:var(--danger)' : ''}"><td><b>ESTIMASI PENGELUARAN RIIL / BULAN</b></td><td class="num"><b>${rupiah(estimasiPengeluaranRiil)}</b></td></tr>
        </tfoot>
      </table></div>
      <p class="hint" style="margin-top:8px">Pendapatan ${rupiah(totalPendapatanBulanan)} − pertumbuhan aset ${rupiah(pertumbuhanAsetPerBulan)} = estimasi pengeluaran ${rupiah(estimasiPengeluaranRiil)} / bulan.
      Rasio aset/pendapatan: <b>${totalPendapatanKumulatif ? pct(totalAset / totalPendapatanKumulatif * 100) : '-'}</b></p>
    </div>` : '<p class="hint" style="margin-top:8px">Isi tanggal untuk melihat perkiraan pendapatan kumulatif.</p>'}
  </div>

  <div class="grid-2">
    <div class="card">
      <h2>Estimasi Pendapatan Bulanan</h2>
      <div class="table-wrap"><table class="compact slip-table" style="max-width:100%">
        <thead><tr><th colspan="2" class="section-head pos">GAJI PNS (NETTO)</th></tr></thead>
        <tbody>
          ${latest ? `${baris('Gaji Pokok', gajiPokok)}
          ${baris('Tunjangan Kinerja', tukin)}
          ${baris('Tunjangan Jabatan', tunjab)}
          ${baris('Potongan (BPJS + Taspen + Tapera)', -potGaji)}
          <tr class="total"><td><b>Gaji Bersih</b></td><td class="num"><b>${rupiah(gajiNetto)}</b></td></tr>`
          : '<tr><td colspan="2" class="muted">Belum ada data gaji. Isi di menu Gaji PNS.</td></tr>'}
        </tbody>
        <thead><tr><th colspan="2" class="section-head pos">KUPON OBLIGASI</th></tr></thead>
        <tbody>
          ${aktifObl.length ? aktifObl.map((o) =>
            baris(`${esc(o.kode)} (${pct(o.kupon)})`, o.saldo_awal * (o.kupon / 100) / 12)
          ).join('') + `<tr class="total"><td><b>Total Kupon / Bulan</b></td><td class="num"><b>${rupiah(kuponBulanan)}</b></td></tr>`
          : '<tr><td colspan="2" class="muted">Belum ada obligasi aktif.</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="netto"><td><b>TOTAL PENDAPATAN / BULAN</b></td><td class="num"><b>${rupiah(totalPendapatanBulanan)}</b></td></tr>
        </tfoot>
      </table></div>
    </div>
    <div class="card">
      <h2>Estimasi Pendapatan Tahunan</h2>
      <div class="table-wrap"><table class="compact slip-table" style="max-width:100%">
        <tbody>
          ${baris('Gaji Bersih × 12 bulan', gajiNetto * 12)}
          ${baris('Kupon Obligasi (total/tahun)', kuponTahunan)}
        </tbody>
        <tfoot>
          <tr class="netto"><td><b>TOTAL PENDAPATAN / TAHUN</b></td><td class="num"><b>${rupiah(totalPendapatanTahunan)}</b></td></tr>
        </tfoot>
      </table></div>
      <h2 style="margin-top:20px">Ringkasan Bulanan</h2>
      <div class="table-wrap"><table class="compact slip-table" style="max-width:100%">
        <tbody>
          ${baris('Total Pendapatan', totalPendapatanBulanan)}
          ${baris('Total Pengeluaran', totalPengeluaran)}
        </tbody>
        <tfoot>
          <tr class="netto" style="${sisa < 0 ? 'background:var(--danger)' : ''}"><td><b>SISA (${sisa >= 0 ? 'SURPLUS' : 'DEFISIT'})</b></td><td class="num"><b>${rupiah(sisa)}</b></td></tr>
        </tfoot>
      </table></div>
      ${perKategori.length ? `<h2 style="margin-top:20px">Per Kategori</h2>
      <div class="table-wrap"><table class="compact">
        <thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">%</th></tr></thead>
        <tbody>${perKategori.map((k) => `<tr><td>${esc(k.kategori)}</td><td class="num">${rupiah(k.total)}</td>
          <td class="num">${pct(totalPengeluaran ? k.total / totalPengeluaran * 100 : 0)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td><b>Total</b></td><td class="num"><b>${rupiah(totalPengeluaran)}</b></td><td class="num"><b>100%</b></td></tr></tfoot>
      </table></div>` : ''}
    </div>
  </div>
  <div class="card">
    <h2>Pengeluaran Bulanan<span class="spacer"></span><button class="btn primary sm" id="addKeluar">+ Tambah</button></h2>
    <p class="hint">Catat estimasi pengeluaran rutin bulanan. Total dipakai untuk menghitung sisa pendapatan.</p>
    ${pengeluaranRows.length ? `<div class="table-wrap"><table class="compact">
      <thead><tr><th>Kategori</th><th>Nama</th><th class="num">Jumlah (Rp)</th><th>Catatan</th><th></th></tr></thead>
      <tbody>${pengeluaranRows.map((r) => `<tr>
        <td>${esc(r.kategori)}</td><td>${esc(r.nama)}</td><td class="num">${rp(r.jumlah)}</td><td>${esc(r.catatan || '')}</td>
        <td class="actions"><button class="btn sm" data-edit="${r.id}">Ubah</button><button class="btn sm danger" data-del="${r.id}">Hapus</button></td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2"><b>Total (${pengeluaranRows.length} pos)</b></td><td class="num"><b>${rp(totalPengeluaran)}</b></td><td colspan="2"></td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada data pengeluaran.</div>'}
  </div>`;

  const form = (r = {}) => formModal(r.id ? 'Ubah pengeluaran' : 'Tambah pengeluaran', [
    { name: 'kategori', label: 'Kategori', type: 'select', value: r.kategori,
      options: KATEGORI_PENGELUARAN.map((k) => ({ value: k, label: k })), required: true },
    { name: 'nama', label: 'Nama pengeluaran', value: r.nama, required: true, placeholder: 'Sewa kos, listrik, makan, dll.' },
    { name: 'jumlah', label: 'Jumlah per bulan (Rp)', type: 'number', step: '1', value: r.jumlah, required: true },
    { name: 'catatan', label: 'Catatan', value: r.catatan },
  ], async (d) => {
    if (r.id) await api('/api/pengeluaran/' + r.id, { method: 'PUT', body: d });
    else await api(withUser('/api/pengeluaran'), { method: 'POST', body: d });
    toast('Tersimpan'); render();
  });

  // --- Grafik ---
  // 1. Bar: Pendapatan vs Pengeluaran vs Surplus
  const barLabels = ['Gaji Netto', 'Kupon Obligasi', 'Total Pendapatan', 'Pengeluaran', sisa >= 0 ? 'Surplus' : 'Defisit'];
  const barData = [gajiNetto, kuponBulanan, totalPendapatanBulanan, totalPengeluaran, sisa];
  const barColors = [PALETTE[0], PALETTE[1], PALETTE[2], PALETTE[3], sisa >= 0 ? PALETTE[0] : '#b4372f'];
  if (bulanKerja > 0) {
    barLabels.push('Est. Pengeluaran Riil');
    barData.push(estimasiPengeluaranRiil > 0 ? estimasiPengeluaranRiil : 0);
    barColors.push(PALETTE[5]);
  }
  chart($('#cArusBar'), 'bar', barLabels, [{ data: barData, backgroundColor: barColors, borderRadius: 4 }]);

  // 2. Doughnut: Komposisi pendapatan
  const pendapatanParts = [];
  if (gajiPokok > 0) pendapatanParts.push({ label: 'Gaji Pokok', total: gajiPokok });
  if (tukin > 0) pendapatanParts.push({ label: 'Tunj. Kinerja', total: tukin });
  if (tunjab > 0) pendapatanParts.push({ label: 'Tunj. Jabatan', total: tunjab });
  if (kuponBulanan > 0) pendapatanParts.push({ label: 'Kupon Obligasi', total: kuponBulanan });
  if (potGaji > 0) pendapatanParts.push({ label: 'Potongan', total: potGaji });
  if (pendapatanParts.length) {
    chart($('#cPendapatan'), 'doughnut', pendapatanParts.map((p) => p.label), pendapatanParts.map((p) => p.total));
  } else { emptyChart($('#cPendapatan')); }

  // 3. Doughnut: Pengeluaran per kategori
  if (perKategori.length) {
    chart($('#cKategori'), 'doughnut', perKategori.map((k) => k.kategori), perKategori.map((k) => k.total));
  } else { emptyChart($('#cKategori'), 'Belum ada data pengeluaran'); }

  $('#saveTglGaji').onclick = async () => {
    try {
      await api(withUser('/api/pengaturan'), { method: 'PUT', body: { tanggal_pertama_gaji: $('#tglGajiInput').value } });
      toast('Tanggal tersimpan'); render();
    } catch (e) { toast(e.message, true); }
  };

  $('#addKeluar').onclick = () => form();
  $$('[data-edit]', v).forEach((b) => b.onclick = () => form(pengeluaranRows.find((r) => r.id === Number(b.dataset.edit))));
  $$('[data-del]', v).forEach((b) => b.onclick = () => confirmDelete('pengeluaran ini', () => api('/api/pengeluaran/' + b.dataset.del, { method: 'DELETE' })));
};

// ---------- Input portofolio (tabel seperti gambar 1) ----------
VIEWS.portofolio = async (v) => {
  const rows = await api(withUser('/api/portofolio'));
  const { jenis, lembaga, penyimpanan } = state.master;
  const opt = (list, sel, labelFn = (x) => x.nama) => `<option value="">— pilih —</option>` +
    list.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(labelFn(x))}</option>`).join('');
  const lembagaOpt = (jenisId, sel) => opt(lembaga.filter((l) => l.jenis_id === Number(jenisId)), sel,
    (l) => (l.singkatan && l.singkatan !== l.nama ? `${l.nama} (${l.singkatan})` : l.nama));

  const rowHtml = (p = {}) => `<tr data-id="${p.id || ''}">
    <td><select class="f-jenis">${opt(jenis.filter((j) => !['Saham', 'Crypto'].includes(j.nama) || j.id === p.jenis_id), p.jenis_id)}</select></td>
    <td><select class="f-lembaga">${p.jenis_id ? lembagaOpt(p.jenis_id, p.lembaga_id) : '<option value="">— pilih jenis dulu —</option>'}</select></td>
    <td><input class="f-rekening" value="${esc(p.nama_rekening || '')}" placeholder="Rek. utama, kantong, dll."></td>
    <td><select class="f-simpan">${opt(penyimpanan, p.penyimpanan_id)}</select></td>
    <td><input class="nilai f-nilai" inputmode="decimal" value="${p.id ? rp(p.nilai) : ''}" placeholder="0"></td>
    <td><input class="f-catatan" value="${esc(p.catatan || '')}" placeholder="Catatan"></td>
    <td class="actions"><button class="btn sm primary b-save" ${p.id ? 'hidden' : ''}>Simpan</button><button class="btn sm danger b-del">Hapus</button></td>
  </tr>`;

  v.innerHTML = `<div class="card">
    <h2>Aset per instrumen<span class="spacer"></span><button class="btn primary sm" id="addRow">+ Tambah baris</button></h2>
    <p class="hint">Isi seperti spreadsheet: pilih jenis → nama → rekening/kantong → penyimpanan, lalu ketik nilainya. Baris yang diubah ditandai kuning dan tersimpan otomatis saat Anda pindah kolom. Obligasi, saham, dan crypto dicatat di menu masing-masing agar tidak terhitung dua kali.</p>
    <div class="table-wrap"><table class="sheet">
      <thead><tr><th style="width:14%">Jenis</th><th style="width:18%">Nama</th><th style="width:14%">Rekening / Kantong</th><th style="width:15%">Penyimpanan</th><th style="width:13%" class="num">Nilai (Rp)</th><th>Catatan</th><th></th></tr></thead>
      <tbody id="sheetBody">${rows.map(rowHtml).join('')}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num" id="sheetTotal"></td><td colspan="2"></td></tr></tfoot>
    </table></div>
  </div>`;

  const body = $('#sheetBody');
  const parseNum = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
  const updateTotal = () => { $('#sheetTotal').textContent = rp($$('.f-nilai', body).reduce((a, i) => a + parseNum(i.value), 0)); };
  updateTotal();

  async function save(tr) {
    const d = {
      jenis_id: $('.f-jenis', tr).value, lembaga_id: $('.f-lembaga', tr).value, nama_rekening: $('.f-rekening', tr).value,
      penyimpanan_id: $('.f-simpan', tr).value, nilai: parseNum($('.f-nilai', tr).value), catatan: $('.f-catatan', tr).value,
    };
    if (!d.jenis_id || !d.lembaga_id || !d.penyimpanan_id) { if (tr.dataset.id) toast('Lengkapi jenis, nama, dan instrumen', true); return; }
    try {
      if (tr.dataset.id) await api('/api/portofolio/' + tr.dataset.id, { method: 'PUT', body: d });
      else {
        const res = await api(withUser('/api/portofolio'), { method: 'POST', body: d });
        tr.dataset.id = res.id; $('.b-save', tr).hidden = true;
      }
      tr.classList.remove('dirty');
      toast('Tersimpan');
    } catch (e) { toast(e.message, true); }
  }

  body.addEventListener('change', (e) => {
    const tr = e.target.closest('tr');
    if (e.target.classList.contains('f-jenis')) $('.f-lembaga', tr).innerHTML = lembagaOpt(e.target.value);
    tr.classList.add('dirty');
    if (tr.dataset.id) save(tr);
  });
  body.addEventListener('input', (e) => { if (e.target.classList.contains('f-nilai')) updateTotal(); e.target.closest('tr').classList.add('dirty'); });
  body.addEventListener('focusout', (e) => { if (e.target.classList.contains('f-nilai') && e.target.value) e.target.value = rp(parseNum(e.target.value)); });
  body.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (e.target.classList.contains('b-save')) save(tr);
    if (e.target.classList.contains('b-del')) {
      if (!tr.dataset.id) { tr.remove(); updateTotal(); return; }
      confirmDelete('baris ini', () => api('/api/portofolio/' + tr.dataset.id, { method: 'DELETE' }));
    }
  });
  $('#addRow').onclick = () => { body.insertAdjacentHTML('beforeend', rowHtml()); $('.f-jenis', body.lastElementChild).focus(); };
  if (!rows.length) $('#addRow').click();
};

// ---------- Obligasi (tabel seperti gambar 2) ----------
VIEWS.obligasi = async (v) => {
  const rows = await api(withUser('/api/obligasi'));
  const tampil = (state.oblFilter || 'semua');
  const list = rows.filter((o) => tampil === 'semua' || o.status === tampil);
  const tot = (k) => list.reduce((a, o) => a + o[k], 0);

  v.innerHTML = `<div class="card">
    <h2>Daftar obligasi<span class="spacer"></span>
      <select id="oblFilter" style="width:auto;margin:0"><option value="semua">Semua</option><option value="Aktif">Aktif</option><option value="Jatuh tempo">Jatuh tempo</option></select>
      <button class="btn primary sm" id="addObl">+ Tambah obligasi</button></h2>
    <p class="hint">Total proyeksi keuntungan = saldo awal × keuntungan per tahun × tahun. Tahun diambil dari tenor pada kode (mis. SR019-<b>T5</b> → 5 tahun).</p>
    ${list.length ? `<div class="table-wrap"><table class="compact">
      <thead><tr><th>Jenis Obligasi</th><th>Kode Obligasi</th><th>Cair Pertama</th><th>Cair Terakhir</th><th class="num">Saldo Awal</th>
        <th class="num">Keuntungan per tahun (%)</th><th class="num">Total Proyeksi Keuntungan</th><th class="num">Tahun</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map((o) => `<tr>
        <td>${esc(o.jenis_obligasi)}</td><td><b>${esc(o.kode)}</b></td><td>${tgl(o.cair_pertama)}</td><td>${tgl(o.cair_terakhir)}</td>
        <td class="num">${rp(o.saldo_awal)}</td><td class="num">${rp(o.kupon)}</td><td class="num">${rp(o.proyeksi)}</td><td class="num">${o.tahun}</td>
        <td><span class="badge ${o.status === 'Aktif' ? '' : 'warn'}">${o.status}</span></td>
        <td class="actions"><button class="btn sm" data-edit="${o.id}">Ubah</button><button class="btn sm danger" data-del="${o.id}">Hapus</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Total (${list.length} seri)</td><td class="num">${rp(tot('saldo_awal'))}</td><td></td><td class="num">${rp(tot('proyeksi'))}</td><td colspan="3"></td></tr></tfoot>
    </table></div>` : '<div class="empty">Belum ada data obligasi.</div>'}
  </div>`;

  $('#oblFilter').value = tampil;
  $('#oblFilter').onchange = (e) => { state.oblFilter = e.target.value; render(); };

  const tempat = state.master.lembaga.filter((l) => ['Bank', 'Platform Investasi'].includes(l.jenis));
  const form = (o = {}) => formModal(o.id ? 'Ubah obligasi' : 'Tambah obligasi', [
    { name: 'jenis_obligasi', label: 'Jenis obligasi', value: o.jenis_obligasi, list: JENIS_OBLIGASI, required: true, half: true },
    { name: 'kode', label: 'Kode obligasi', value: o.kode, placeholder: 'SR023-T3', required: true, half: true },
    { name: 'cair_pertama', label: 'Cair pertama', type: 'date', value: o.cair_pertama, required: true, half: true },
    { name: 'cair_terakhir', label: 'Cair terakhir (jatuh tempo)', type: 'date', value: o.cair_terakhir, required: true, half: true },
    { name: 'saldo_awal', label: 'Saldo awal (Rp)', type: 'number', step: '1', value: o.saldo_awal, required: true, half: true },
    { name: 'kupon', label: 'Keuntungan per tahun (%)', type: 'number', step: '0.01', value: o.kupon, required: true, half: true },
    { name: 'lembaga_id', label: 'Dibeli melalui (opsional)', type: 'select', value: o.lembaga_id,
      options: [{ value: '', label: '—' }, ...tempat.map((l) => ({ value: l.id, label: `${l.nama} · ${l.jenis}` }))] },
    { name: 'catatan', label: 'Catatan', value: o.catatan },
  ], async (d) => {
    if (o.id) await api('/api/obligasi/' + o.id, { method: 'PUT', body: d });
    else await api(withUser('/api/obligasi'), { method: 'POST', body: d });
    toast('Tersimpan'); render();
  });

  $('#addObl').onclick = () => form();
  $$('[data-edit]', v).forEach((b) => b.onclick = () => form(rows.find((o) => o.id === Number(b.dataset.edit))));
  $$('[data-del]', v).forEach((b) => b.onclick = () => confirmDelete('obligasi ini', () => api('/api/obligasi/' + b.dataset.del, { method: 'DELETE' })));
};

// ---------- Tabel master (generik) ----------
function masterView(t, cols, fields, extra = {}) {
  return async (v) => {
    let rows = state.master[t];
    const admin = isAdmin();
    const filter = extra.filter ? (state.filters?.[t] || '') : '';
    const q = (state.search?.[t] || '').toLowerCase();
    if (filter) rows = rows.filter((r) => String(r.jenis_id) === filter);
    if (q) rows = rows.filter((r) => cols.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)));

    v.innerHTML = `<div class="card">
      <h2>${TITLES[t]} <span class="badge">${rows.length}</span><span class="spacer"></span>
        ${admin ? '<button class="btn primary sm" id="addM">+ Tambah</button>' : ''}</h2>
      <div class="toolbar" style="margin-bottom:12px">
        ${extra.filter ? `<select id="fJenis"><option value="">Semua jenis</option>${state.master.jenis.map((j) => `<option value="${j.id}" ${String(j.id) === filter ? 'selected' : ''}>${esc(j.nama)}</option>`).join('')}</select>` : ''}
        <input id="fCari" placeholder="Cari…" value="${esc(state.search?.[t] || '')}" style="max-width:240px">
        ${admin ? '' : '<span class="hint">Hanya admin yang dapat mengubah tabel master.</span>'}
      </div>
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>#</th>${cols.map((c) => `<th>${c.label}</th>`).join('')}${admin ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td class="muted">${i + 1}</td>${cols.map((c) => `<td>${esc(r[c.key])}</td>`).join('')}
          ${admin ? `<td class="actions"><button class="btn sm" data-edit="${r.id}">Ubah</button><button class="btn sm danger" data-del="${r.id}">Hapus</button></td>` : ''}</tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty">Tidak ada data.</div>'}
    </div>`;

    $('#fCari').oninput = (e) => {
      state.search = { ...state.search, [t]: e.target.value };
      clearTimeout(state._s); state._s = setTimeout(() => { render().then(() => { const el = $('#fCari'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }); }, 250);
    };
    if (extra.filter) $('#fJenis').onchange = (e) => { state.filters = { ...state.filters, [t]: e.target.value }; render(); };
    if (!admin) return;

    const form = (r = {}) => formModal(r.id ? 'Ubah data' : 'Tambah data', fields(r), async (d) => {
      if (r.id) await api(`/api/master/${t}/${r.id}`, { method: 'PUT', body: d });
      else await api(`/api/master/${t}`, { method: 'POST', body: d });
      toast('Tersimpan'); render();
    });
    $('#addM').onclick = () => form(extra.filter && filter ? { jenis_id: Number(filter) } : {});
    $$('[data-edit]', v).forEach((b) => b.onclick = () => form(state.master[t].find((r) => r.id === Number(b.dataset.edit))));
    $$('[data-del]', v).forEach((b) => b.onclick = () => confirmDelete('data ini', () => api(`/api/master/${t}/${b.dataset.del}`, { method: 'DELETE' })));
  };
}

VIEWS.jenis = masterView('jenis',
  [{ key: 'nama', label: 'Jenis Instrumen Keuangan' }, { key: 'keterangan', label: 'Keterangan' }],
  (r) => [{ name: 'nama', label: 'Nama jenis', value: r.nama, required: true }, { name: 'keterangan', label: 'Keterangan', value: r.keterangan }]);

VIEWS.lembaga = masterView('lembaga',
  [{ key: 'jenis', label: 'Jenis' }, { key: 'nama', label: 'Nama Instrumen Keuangan' }, { key: 'singkatan', label: 'Singkatan / Kode' }],
  (r) => [
    { name: 'jenis_id', label: 'Jenis instrumen', type: 'select', value: r.jenis_id, required: true, options: state.master.jenis.map((j) => ({ value: j.id, label: j.nama })) },
    { name: 'nama', label: 'Nama (bank, e-wallet, emiten saham, KUE, dll.)', value: r.nama, required: true },
    { name: 'singkatan', label: 'Singkatan / kode saham', value: r.singkatan, placeholder: 'mis. BCA, BBCA' },
  ], { filter: true });

VIEWS.penyimpanan = masterView('penyimpanan',
  [{ key: 'nama', label: 'Instrumen Investasi / Penyimpanan' }, { key: 'keterangan', label: 'Keterangan' }],
  (r) => [{ name: 'nama', label: 'Nama instrumen', value: r.nama, required: true }, { name: 'keterangan', label: 'Keterangan', value: r.keterangan }]);

// ---------- Pengguna ----------
VIEWS.users = async (v) => {
  const users = await api('/api/users');
  v.innerHTML = `<div class="card">
    <h2>Pengguna <span class="badge">${users.length}</span><span class="spacer"></span><button class="btn primary sm" id="addU">+ Tambah pengguna</button></h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Nama pengguna</th><th>Nama lengkap</th><th>Peran</th><th>Dibuat</th><th></th></tr></thead>
      <tbody>${users.map((u) => `<tr><td><b>${esc(u.username)}</b></td><td>${esc(u.nama_lengkap)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'warn' : ''}">${u.role}</span></td><td class="muted">${esc(u.created_at.slice(0, 10))}</td>
        <td class="actions"><button class="btn sm" data-edit="${u.id}">Ubah</button>${u.id !== state.me.id ? `<button class="btn sm danger" data-del="${u.id}">Hapus</button>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="hint">Admin dapat mengelola tabel master dan melihat data semua pengguna. Pengguna biasa hanya mengelola datanya sendiri.</p>
  </div>`;

  const form = (u = {}) => formModal(u.id ? 'Ubah pengguna' : 'Tambah pengguna', [
    { name: 'username', label: 'Nama pengguna', value: u.username, required: true, half: true },
    { name: 'nama_lengkap', label: 'Nama lengkap', value: u.nama_lengkap, half: true },
    { name: 'password', label: u.id ? 'Kata sandi baru (kosongkan jika tidak diubah)' : 'Kata sandi (min. 6 karakter)', type: 'password', required: !u.id },
    { name: 'role', label: 'Peran', type: 'select', value: u.role || 'user', options: [{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }] },
  ], async (d) => {
    if (u.id) await api('/api/users/' + u.id, { method: 'PUT', body: d });
    else await api('/api/users', { method: 'POST', body: d });
    toast('Tersimpan'); await loadUserPick(); render();
  });
  $('#addU').onclick = () => form();
  $$('[data-edit]', v).forEach((b) => b.onclick = () => form(users.find((u) => u.id === Number(b.dataset.edit))));
  $$('[data-del]', v).forEach((b) => b.onclick = () => confirmDelete('pengguna ini beserta seluruh datanya', async () => { await api('/api/users/' + b.dataset.del, { method: 'DELETE' }); await loadUserPick(); }));
};

// ================= Mulai =================
api('/api/me').then((me) => { state.me = me; start(); }).catch(() => showLogin());
