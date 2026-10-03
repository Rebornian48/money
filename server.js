// Web Manajemen Keuangan — Express + SQLite
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { db, DB_FILE } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieSession({
  name: 'mk_sess',
  keys: [process.env.SESSION_SECRET || 'ganti-dengan-rahasia-panjang'],
  maxAge: 8 * 60 * 60 * 1000, // 8 jam
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === '1',
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules', 'chart.js', 'dist')));

// ---------- Helper ----------
const wrap = (fn) => (req, res) => {
  try { fn(req, res); } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
      const msg = /FOREIGN KEY/i.test(e.message) || e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
        ? 'Data masih dipakai oleh data lain, tidak bisa dihapus/diubah.'
        : e.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Data dengan nama tersebut sudah ada.'
        : 'Data tidak valid.';
      return res.status(409).json({ error: msg });
    }
    console.error(e);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const str = (v) => (v === undefined || v === null ? '' : String(v).trim());

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Silakan login.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Khusus admin.' });
  next();
}
// Admin boleh melihat data pengguna lain lewat ?user_id=
function targetUser(req) {
  const u = req.session.user;
  const q = Number(req.query.user_id || req.body?.user_id);
  return u.role === 'admin' && q ? q : u.id;
}
function canTouch(req, ownerId) {
  const u = req.session.user;
  return u.role === 'admin' || u.id === ownerId;
}

// ---------- Auth ----------
app.post('/api/login', wrap((req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(str(req.body.username));
  if (!user || !bcrypt.compareSync(str(req.body.password), user.password_hash)) {
    return res.status(401).json({ error: 'Nama pengguna atau kata sandi salah.' });
  }
  req.session.user = { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role };
  res.json(req.session.user);
}));
app.post('/api/logout', (req, res) => { req.session = null; res.json({ ok: true }); });
app.get('/api/me', requireAuth, (req, res) => res.json(req.session.user));
app.post('/api/me/password', requireAuth, wrap((req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!bcrypt.compareSync(str(req.body.lama), user.password_hash)) return res.status(400).json({ error: 'Kata sandi lama salah.' });
  if (str(req.body.baru).length < 6) return res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(str(req.body.baru), 10), user.id);
  res.json({ ok: true });
}));

// ---------- Manajemen pengguna (admin) ----------
app.get('/api/users', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, username, nama_lengkap, role, created_at FROM users ORDER BY username').all());
});
app.post('/api/users', requireAdmin, wrap((req, res) => {
  const username = str(req.body.username), password = str(req.body.password);
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  if (!username || password.length < 6) return res.status(400).json({ error: 'Nama pengguna wajib, kata sandi minimal 6 karakter.' });
  const info = db.prepare('INSERT INTO users (username, password_hash, nama_lengkap, role) VALUES (?,?,?,?)')
    .run(username, bcrypt.hashSync(password, 10), str(req.body.nama_lengkap), role);
  res.json({ id: info.lastInsertRowid });
}));
app.put('/api/users/:id', requireAdmin, wrap((req, res) => {
  const id = Number(req.params.id);
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (current.role === 'admin' && role !== 'admin' && adminCount() <= 1) {
    return res.status(400).json({ error: 'Minimal harus ada satu admin.' });
  }
  db.prepare('UPDATE users SET username = ?, nama_lengkap = ?, role = ? WHERE id = ?')
    .run(str(req.body.username) || current.username, str(req.body.nama_lengkap), role, id);
  if (str(req.body.password)) {
    if (str(req.body.password).length < 6) return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(str(req.body.password), 10), id);
  }
  res.json({ ok: true });
}));
app.delete('/api/users/:id', requireAdmin, wrap((req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.user.id) return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
}));
const adminCount = () => db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;

// ---------- Tabel master (jenis, lembaga, penyimpanan) ----------
const MASTER = {
  jenis: { table: 'jenis_instrumen', fields: ['nama', 'keterangan'],
    list: 'SELECT * FROM jenis_instrumen ORDER BY id' },
  lembaga: { table: 'lembaga', fields: ['jenis_id', 'nama', 'singkatan'],
    list: `SELECT l.*, j.nama AS jenis FROM lembaga l JOIN jenis_instrumen j ON j.id = l.jenis_id
           ORDER BY j.id, l.nama` },
  penyimpanan: { table: 'instrumen_penyimpanan', fields: ['nama', 'keterangan'],
    list: 'SELECT * FROM instrumen_penyimpanan ORDER BY id' },
};
function master(req, res, next) {
  const m = MASTER[req.params.t];
  if (!m) return res.status(404).json({ error: 'Tabel tidak dikenal.' });
  req.m = m; next();
}
const masterValues = (m, body) => m.fields.map((f) => (f.endsWith('_id') ? Number(body[f]) : str(body[f])));

app.get('/api/master/:t', requireAuth, master, (req, res) => res.json(db.prepare(req.m.list).all()));
app.post('/api/master/:t', requireAdmin, master, wrap((req, res) => {
  if (!str(req.body.nama)) return res.status(400).json({ error: 'Nama wajib diisi.' });
  const { table, fields } = req.m;
  const info = db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`)
    .run(...masterValues(req.m, req.body));
  res.json({ id: info.lastInsertRowid });
}));
app.put('/api/master/:t/:id', requireAdmin, master, wrap((req, res) => {
  if (!str(req.body.nama)) return res.status(400).json({ error: 'Nama wajib diisi.' });
  const { table, fields } = req.m;
  db.prepare(`UPDATE ${table} SET ${fields.map((f) => `${f} = ?`).join(',')} WHERE id = ?`)
    .run(...masterValues(req.m, req.body), Number(req.params.id));
  res.json({ ok: true });
}));
app.delete('/api/master/:t/:id', requireAdmin, master, wrap((req, res) => {
  db.prepare(`DELETE FROM ${req.m.table} WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
}));

// ---------- Portofolio (inputan pengguna, gambar 1) ----------
const PORTO_SQL = `
  SELECT p.*, j.nama AS jenis, l.nama AS lembaga, l.singkatan, s.nama AS penyimpanan
  FROM portofolio p
  JOIN jenis_instrumen j ON j.id = p.jenis_id
  JOIN lembaga l ON l.id = p.lembaga_id
  JOIN instrumen_penyimpanan s ON s.id = p.penyimpanan_id
  WHERE p.user_id = ? ORDER BY j.id, l.nama, s.nama`;

function validPorto(b) {
  const v = { jenis_id: num(b.jenis_id), lembaga_id: num(b.lembaga_id), penyimpanan_id: num(b.penyimpanan_id), nilai: num(b.nilai) };
  if ([v.jenis_id, v.lembaga_id, v.penyimpanan_id].some((x) => !x)) return { error: 'Jenis, nama, dan instrumen wajib dipilih.' };
  if (!Number.isFinite(v.nilai) || v.nilai < 0) return { error: 'Nilai harus angka ≥ 0.' };
  const l = db.prepare('SELECT jenis_id FROM lembaga WHERE id = ?').get(v.lembaga_id);
  if (!l || l.jenis_id !== v.jenis_id) return { error: 'Nama instrumen tidak sesuai dengan jenisnya.' };
  v.catatan = str(b.catatan);
  return v;
}

app.get('/api/portofolio', requireAuth, (req, res) => res.json(db.prepare(PORTO_SQL).all(targetUser(req))));
app.post('/api/portofolio', requireAuth, wrap((req, res) => {
  const v = validPorto(req.body);
  if (v.error) return res.status(400).json(v);
  const info = db.prepare(`INSERT INTO portofolio (user_id, jenis_id, lembaga_id, penyimpanan_id, nilai, catatan)
                           VALUES (?,?,?,?,?,?)`).run(targetUser(req), v.jenis_id, v.lembaga_id, v.penyimpanan_id, v.nilai, v.catatan);
  res.json({ id: info.lastInsertRowid });
}));
app.put('/api/portofolio/:id', requireAuth, wrap((req, res) => {
  const row = db.prepare('SELECT user_id FROM portofolio WHERE id = ?').get(Number(req.params.id));
  if (!row || !canTouch(req, row.user_id)) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  const v = validPorto(req.body);
  if (v.error) return res.status(400).json(v);
  db.prepare(`UPDATE portofolio SET jenis_id=?, lembaga_id=?, penyimpanan_id=?, nilai=?, catatan=?, updated_at=CURRENT_TIMESTAMP
              WHERE id = ?`).run(v.jenis_id, v.lembaga_id, v.penyimpanan_id, v.nilai, v.catatan, Number(req.params.id));
  res.json({ ok: true });
}));
app.delete('/api/portofolio/:id', requireAuth, wrap((req, res) => {
  const row = db.prepare('SELECT user_id FROM portofolio WHERE id = ?').get(Number(req.params.id));
  if (!row || !canTouch(req, row.user_id)) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  db.prepare('DELETE FROM portofolio WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

// ---------- Obligasi (gambar 2) ----------
// Tahun = tenor dari kode (mis. "SR019-T5" → 5); jika tidak ada, dibulatkan dari selisih tanggal.
function hitungObligasi(o) {
  const m = /-T(\d+)\s*$/i.exec(o.kode || '');
  let tahun = m ? Number(m[1]) : 0;
  if (!tahun && o.cair_pertama && o.cair_terakhir) {
    tahun = Math.round((new Date(o.cair_terakhir) - new Date(o.cair_pertama)) / (365.25 * 864e5));
  }
  const proyeksi = Math.round(o.saldo_awal * (o.kupon / 100) * tahun);
  const today = new Date().toISOString().slice(0, 10);
  const status = o.cair_terakhir && o.cair_terakhir < today ? 'Jatuh tempo' : 'Aktif';
  return { ...o, tahun, proyeksi, status };
}
const OBL_SQL = `SELECT o.*, l.nama AS lembaga FROM obligasi o LEFT JOIN lembaga l ON l.id = o.lembaga_id
                 WHERE o.user_id = ? ORDER BY o.cair_pertama, o.kode`;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function validObl(b) {
  const v = {
    jenis_obligasi: str(b.jenis_obligasi), kode: str(b.kode).toUpperCase(),
    cair_pertama: str(b.cair_pertama), cair_terakhir: str(b.cair_terakhir),
    saldo_awal: num(b.saldo_awal), kupon: num(b.kupon),
    lembaga_id: num(b.lembaga_id) || null, catatan: str(b.catatan),
  };
  if (!v.jenis_obligasi || !v.kode) return { error: 'Jenis dan kode obligasi wajib diisi.' };
  if (!isDate(v.cair_pertama) || !isDate(v.cair_terakhir)) return { error: 'Tanggal cair pertama & terakhir wajib diisi.' };
  if (v.cair_terakhir < v.cair_pertama) return { error: 'Cair terakhir harus setelah cair pertama.' };
  if (!(v.saldo_awal >= 0) || !(v.kupon >= 0)) return { error: 'Saldo dan keuntungan harus angka ≥ 0.' };
  return v;
}
const OBL_FIELDS = ['jenis_obligasi', 'kode', 'cair_pertama', 'cair_terakhir', 'saldo_awal', 'kupon', 'lembaga_id', 'catatan'];

app.get('/api/obligasi', requireAuth, (req, res) => res.json(db.prepare(OBL_SQL).all(targetUser(req)).map(hitungObligasi)));
app.post('/api/obligasi', requireAuth, wrap((req, res) => {
  const v = validObl(req.body);
  if (v.error) return res.status(400).json(v);
  const info = db.prepare(`INSERT INTO obligasi (user_id, ${OBL_FIELDS.join(',')}) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(targetUser(req), ...OBL_FIELDS.map((f) => v[f]));
  res.json({ id: info.lastInsertRowid });
}));
app.put('/api/obligasi/:id', requireAuth, wrap((req, res) => {
  const row = db.prepare('SELECT user_id FROM obligasi WHERE id = ?').get(Number(req.params.id));
  if (!row || !canTouch(req, row.user_id)) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  const v = validObl(req.body);
  if (v.error) return res.status(400).json(v);
  db.prepare(`UPDATE obligasi SET ${OBL_FIELDS.map((f) => `${f}=?`).join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...OBL_FIELDS.map((f) => v[f]), Number(req.params.id));
  res.json({ ok: true });
}));
app.delete('/api/obligasi/:id', requireAuth, wrap((req, res) => {
  const row = db.prepare('SELECT user_id FROM obligasi WHERE id = ?').get(Number(req.params.id));
  if (!row || !canTouch(req, row.user_id)) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  db.prepare('DELETE FROM obligasi WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

// ---------- Saham ----------
// 1 lot = 100 lembar. Nilai pasar memakai harga terkini (jika kosong, harga beli).
function hitungSaham(s) {
  const lembar = s.lot * 100;
  const modal = lembar * s.harga_beli;
  const harga = s.harga_terkini > 0 ? s.harga_terkini : s.harga_beli;
  const nilai = lembar * harga;
  const laba = nilai - modal;
  return { ...s, lembar, modal, nilai, laba, persen: modal ? (laba / modal) * 100 : 0 };
}
const SAHAM_SQL = `
  SELECT s.*, e.singkatan AS kode, e.nama AS emiten, k.nama AS sekuritas
  FROM saham s
  JOIN lembaga e ON e.id = s.emiten_id
  LEFT JOIN lembaga k ON k.id = s.sekuritas_id
  WHERE s.user_id = ? ORDER BY e.singkatan, s.tanggal_beli`;
const SAHAM_FIELDS = ['emiten_id', 'sekuritas_id', 'tanggal_beli', 'lot', 'harga_beli', 'harga_terkini', 'catatan'];

function validSaham(b) {
  const v = {
    emiten_id: num(b.emiten_id), sekuritas_id: num(b.sekuritas_id) || null,
    tanggal_beli: str(b.tanggal_beli) || null, lot: num(b.lot), harga_beli: num(b.harga_beli),
    harga_terkini: str(b.harga_terkini) === '' ? null : num(b.harga_terkini), catatan: str(b.catatan),
  };
  const e = db.prepare(`SELECT j.nama FROM lembaga l JOIN jenis_instrumen j ON j.id = l.jenis_id WHERE l.id = ?`).get(v.emiten_id);
  if (!e || e.nama !== 'Saham') return { error: 'Pilih emiten saham.' };
  if (v.tanggal_beli && !isDate(v.tanggal_beli)) return { error: 'Tanggal beli tidak valid.' };
  if (!(v.lot > 0)) return { error: 'Jumlah lot harus lebih dari 0.' };
  if (!(v.harga_beli > 0)) return { error: 'Harga beli harus lebih dari 0.' };
  if (v.harga_terkini !== null && !(v.harga_terkini >= 0)) return { error: 'Harga terkini harus angka ≥ 0.' };
  return v;
}
function ownedSaham(req, res) {
  const row = db.prepare('SELECT * FROM saham WHERE id = ?').get(Number(req.params.id));
  if (!row || !canTouch(req, row.user_id)) { res.status(404).json({ error: 'Data tidak ditemukan.' }); return null; }
  return row;
}

app.get('/api/saham', requireAuth, (req, res) => res.json(db.prepare(SAHAM_SQL).all(targetUser(req)).map(hitungSaham)));
app.post('/api/saham', requireAuth, wrap((req, res) => {
  const v = validSaham(req.body);
  if (v.error) return res.status(400).json(v);
  const info = db.prepare(`INSERT INTO saham (user_id, ${SAHAM_FIELDS.join(',')}) VALUES (?,?,?,?,?,?,?,?)`)
    .run(targetUser(req), ...SAHAM_FIELDS.map((f) => v[f]));
  res.json({ id: info.lastInsertRowid });
}));
app.put('/api/saham/:id', requireAuth, wrap((req, res) => {
  if (!ownedSaham(req, res)) return;
  const v = validSaham(req.body);
  if (v.error) return res.status(400).json(v);
  db.prepare(`UPDATE saham SET ${SAHAM_FIELDS.map((f) => `${f}=?`).join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...SAHAM_FIELDS.map((f) => v[f]), Number(req.params.id));
  res.json({ ok: true });
}));
// Perbarui harga terkini saja (dipakai input cepat di tabel)
app.patch('/api/saham/:id/harga', requireAuth, wrap((req, res) => {
  if (!ownedSaham(req, res)) return;
  const h = num(req.body.harga_terkini);
  if (!(h >= 0)) return res.status(400).json({ error: 'Harga harus angka ≥ 0.' });
  db.prepare('UPDATE saham SET harga_terkini = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(h, Number(req.params.id));
  res.json({ ok: true });
}));
app.delete('/api/saham/:id', requireAuth, wrap((req, res) => {
  if (!ownedSaham(req, res)) return;
  db.prepare('DELETE FROM saham WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

// ---------- Dashboard ----------
app.get('/api/dashboard', requireAuth, (req, res) => {
  const uid = targetUser(req);
  const group = (col, join) => db.prepare(`
    SELECT ${col} AS label, SUM(p.nilai) AS total, COUNT(*) AS jumlah
    FROM portofolio p ${join} WHERE p.user_id = ? GROUP BY ${col} HAVING total > 0 ORDER BY total DESC`).all(uid);

  const perJenis = group('j.nama', 'JOIN jenis_instrumen j ON j.id = p.jenis_id');
  const perPenyimpanan = group('s.nama', 'JOIN instrumen_penyimpanan s ON s.id = p.penyimpanan_id');
  const perLembaga = group('l.nama', 'JOIN lembaga l ON l.id = p.lembaga_id');
  const totalPorto = perJenis.reduce((a, r) => a + r.total, 0);

  const obl = db.prepare(OBL_SQL).all(uid).map(hitungObligasi);
  const aktif = obl.filter((o) => o.status === 'Aktif');
  const oblPerJenis = Object.values(aktif.reduce((acc, o) => {
    acc[o.jenis_obligasi] ??= { label: o.jenis_obligasi, total: 0, proyeksi: 0, jumlah: 0 };
    acc[o.jenis_obligasi].total += o.saldo_awal;
    acc[o.jenis_obligasi].proyeksi += o.proyeksi;
    acc[o.jenis_obligasi].jumlah += 1;
    return acc;
  }, {})).sort((a, b) => b.total - a.total);
  const totalObl = aktif.reduce((a, o) => a + o.saldo_awal, 0);

  // Saham, digabung per kode emiten
  const saham = db.prepare(SAHAM_SQL).all(uid).map(hitungSaham);
  const sahamPerEmiten = Object.values(saham.reduce((acc, s) => {
    acc[s.kode] ??= { label: s.kode, emiten: s.emiten, lot: 0, modal: 0, total: 0 };
    acc[s.kode].lot += s.lot; acc[s.kode].modal += s.modal; acc[s.kode].total += s.nilai;
    return acc;
  }, {})).map((r) => ({ ...r, laba: r.total - r.modal, persen: r.modal ? ((r.total - r.modal) / r.modal) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
  const totalSaham = saham.reduce((a, s) => a + s.nilai, 0);
  const modalSaham = saham.reduce((a, s) => a + s.modal, 0);

  // Komposisi aset gabungan: portofolio per instrumen + obligasi aktif + saham
  const komposisi = perPenyimpanan.map((r) => ({ label: r.label, total: r.total }));
  const tambah = (label, total) => {
    if (total <= 0) return;
    const ada = komposisi.find((r) => r.label === label);
    if (ada) ada.total += total; else komposisi.push({ label, total });
  };
  tambah('Obligasi', totalObl);
  tambah('Saham', totalSaham);
  komposisi.sort((a, b) => b.total - a.total);

  res.json({
    ringkas: {
      totalPorto, totalObl, totalSaham, totalAset: totalPorto + totalObl + totalSaham,
      proyeksiObl: aktif.reduce((a, o) => a + o.proyeksi, 0),
      kuponRata: totalObl ? aktif.reduce((a, o) => a + o.kupon * o.saldo_awal, 0) / totalObl : 0,
      jumlahObl: aktif.length,
      modalSaham, labaSaham: totalSaham - modalSaham,
      persenSaham: modalSaham ? ((totalSaham - modalSaham) / modalSaham) * 100 : 0,
      jumlahEmiten: sahamPerEmiten.length,
    },
    perJenis, perPenyimpanan, perLembaga, komposisi, oblPerJenis, sahamPerEmiten,
    obligasi: obl,
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Manajemen Keuangan berjalan di port ${PORT} — database: ${DB_FILE}`));
