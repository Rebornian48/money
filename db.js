// Koneksi SQLite, skema tabel, dan data awal
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const os = require('os');

// PENTING (Hostinger): folder aplikasi diganti setiap redeploy, jadi database
// disimpan di luar folder aplikasi (default: ~/manajemen-keuangan-data).
const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), 'manajemen-keuangan-data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'keuangan.db');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  nama_lengkap TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jenis_instrumen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL UNIQUE COLLATE NOCASE,
  keterangan TEXT
);

CREATE TABLE IF NOT EXISTS lembaga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis_id INTEGER NOT NULL REFERENCES jenis_instrumen(id) ON DELETE RESTRICT,
  nama TEXT NOT NULL,
  singkatan TEXT,
  UNIQUE (jenis_id, nama)
);

CREATE TABLE IF NOT EXISTS instrumen_penyimpanan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL UNIQUE COLLATE NOCASE,
  keterangan TEXT
);

CREATE TABLE IF NOT EXISTS portofolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jenis_id INTEGER NOT NULL REFERENCES jenis_instrumen(id) ON DELETE RESTRICT,
  lembaga_id INTEGER NOT NULL REFERENCES lembaga(id) ON DELETE RESTRICT,
  penyimpanan_id INTEGER NOT NULL REFERENCES instrumen_penyimpanan(id) ON DELETE RESTRICT,
  nama_rekening TEXT NOT NULL DEFAULT '',
  nilai REAL NOT NULL DEFAULT 0,
  catatan TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS obligasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jenis_obligasi TEXT NOT NULL,
  kode TEXT NOT NULL,
  cair_pertama TEXT,
  cair_terakhir TEXT,
  saldo_awal REAL NOT NULL DEFAULT 0,
  kupon REAL NOT NULL DEFAULT 0,
  lembaga_id INTEGER REFERENCES lembaga(id) ON DELETE SET NULL,
  catatan TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saham (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emiten_id INTEGER NOT NULL REFERENCES lembaga(id) ON DELETE RESTRICT,
  sekuritas_id INTEGER REFERENCES lembaga(id) ON DELETE SET NULL,
  tanggal_beli TEXT,
  lot REAL NOT NULL DEFAULT 0,
  harga_beli REAL NOT NULL DEFAULT 0,
  harga_terkini REAL,
  catatan TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crypto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_id INTEGER REFERENCES lembaga(id) ON DELETE SET NULL,
  nama_aset TEXT NOT NULL,
  simbol TEXT NOT NULL,
  jumlah REAL NOT NULL DEFAULT 0,
  harga_beli REAL NOT NULL DEFAULT 0,
  harga_terkini REAL,
  catatan TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// ---------- Data awal ----------
const SEED = {
  jenis: [
    ['E-Wallet', 'Dompet digital'],
    ['Bank', 'Rekening bank (tabungan, giro, deposito)'],
    ['KUE', 'Kartu Uang Elektronik'],
    ['Saham', 'Emiten di Bursa Efek Indonesia'],
    ['Platform Investasi', 'Sekuritas, aplikasi emas, reksa dana'],
    ['Crypto', 'Aset kripto / cryptocurrency'],
  ],
  lembaga: {
    'Bank': [
      ['Bank Central Asia', 'BCA'], ['Bank Rakyat Indonesia', 'BRI'], ['Bank Mandiri', 'Mandiri'],
      ['Bank Negara Indonesia', 'BNI'], ['Bank Tabungan Negara', 'BTN'], ['Bank Syariah Indonesia', 'BSI'],
      ['Bank CIMB Niaga', 'CIMB'], ['Bank Permata', 'Permata'], ['Bank Danamon', 'Danamon'],
      ['Bank OCBC Indonesia', 'OCBC'], ['Bank Panin', 'Panin'], ['Maybank Indonesia', 'Maybank'],
      ['Bank SMBC Indonesia (Jenius)', 'SMBCI'], ['Bank Mega', 'Mega'], ['Bank Sinarmas', 'Sinarmas'],
      ['Bank Jago', 'Jago'], ['SeaBank Indonesia', 'SeaBank'], ['blu by BCA Digital', 'blu'],
      ['Bank Neo Commerce', 'BNC'], ['Allo Bank', 'Allo'], ['Bank Raya', 'Raya'],
      ['Bank Muamalat', 'Muamalat'], ['Bank DKI', 'DKI'], ['Bank BJB', 'BJB'], ['Bank Jatim', 'Jatim'],
    ],
    'E-Wallet': [
      ['GoPay', 'GoPay'], ['OVO', 'OVO'], ['DANA', 'DANA'], ['ShopeePay', 'ShopeePay'],
      ['LinkAja', 'LinkAja'], ['i.saku', 'i.saku'], ['Sakuku', 'Sakuku'], ['DOKU', 'DOKU'],
      ['AstraPay', 'AstraPay'], ['Flip', 'Flip'],
    ],
    'KUE': [
      ['Flazz (BCA)', 'Flazz'], ['e-money (Mandiri)', 'e-money'], ['Brizzi (BRI)', 'Brizzi'],
      ['TapCash (BNI)', 'TapCash'], ['JakCard (Bank DKI)', 'JakCard'], ['Mega Cash (Bank Mega)', 'MegaCash'],
    ],
    'Saham': [
      ['Bank Central Asia Tbk', 'BBCA'], ['Bank Rakyat Indonesia (Persero) Tbk', 'BBRI'],
      ['Bank Mandiri (Persero) Tbk', 'BMRI'], ['Bank Negara Indonesia (Persero) Tbk', 'BBNI'],
      ['Bank Syariah Indonesia Tbk', 'BRIS'], ['Telkom Indonesia (Persero) Tbk', 'TLKM'],
      ['Astra International Tbk', 'ASII'], ['Unilever Indonesia Tbk', 'UNVR'],
      ['Indofood CBP Sukses Makmur Tbk', 'ICBP'], ['Indofood Sukses Makmur Tbk', 'INDF'],
      ['GoTo Gojek Tokopedia Tbk', 'GOTO'], ['Aneka Tambang Tbk', 'ANTM'],
      ['Alamtri Resources Indonesia Tbk', 'ADRO'], ['Perusahaan Gas Negara Tbk', 'PGAS'],
      ['Kalbe Farma Tbk', 'KLBF'], ['Charoen Pokphand Indonesia Tbk', 'CPIN'],
      ['United Tractors Tbk', 'UNTR'], ['Sumber Alfaria Trijaya Tbk', 'AMRT'],
      ['Merdeka Copper Gold Tbk', 'MDKA'], ['Bukit Asam Tbk', 'PTBA'],
      ['Indo Tambangraya Megah Tbk', 'ITMG'], ['Vale Indonesia Tbk', 'INCO'],
      ['Semen Indonesia (Persero) Tbk', 'SMGR'], ['XLSmart Telecom Sejahtera Tbk', 'EXCL'],
      ['Indosat Tbk', 'ISAT'], ['Jasa Marga (Persero) Tbk', 'JSMR'],
      ['Mitra Adiperkasa Tbk', 'MAPI'], ['HM Sampoerna Tbk', 'HMSP'], ['Gudang Garam Tbk', 'GGRM'],
      ['Bank Jago Tbk', 'ARTO'],
    ],
    'Platform Investasi': [
      ['Pegadaian', 'Pegadaian'], ['Bibit', 'Bibit'], ['Bareksa', 'Bareksa'], ['Pluang', 'Pluang'],
      ['Ajaib', 'Ajaib'], ['Stockbit', 'Stockbit'], ['IPOT (Indo Premier)', 'IPOT'],
    ],
    'Crypto': [
      ['Indodax', 'Indodax'], ['Tokocrypto', 'Tokocrypto'], ['Pintu', 'Pintu'],
      ['Rekeningku', 'Rekeningku'], ['Luno', 'Luno'],
    ],
  },
  penyimpanan: [
    ['Kantong', 'Saldo/kantong di e-wallet atau bank digital'],
    ['Tabungan', 'Rekening tabungan biasa'],
    ['Deposito', 'Simpanan berjangka'],
    ['Saham', 'Kepemilikan saham'],
    ['Obligasi', 'SBN ritel / obligasi korporasi'],
    ['Reksa Dana', 'Reksa dana'],
    ['Emas', 'Emas fisik / digital'],
    ['Kripto', 'Aset kripto'],
    ['Giro', 'Rekening giro'],
  ],
};

function seed() {
  const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;

  db.transaction(() => {
    if (count('jenis_instrumen') === 0) {
      const ins = db.prepare('INSERT INTO jenis_instrumen (nama, keterangan) VALUES (?, ?)');
      SEED.jenis.forEach((j) => ins.run(...j));
    }
    if (count('lembaga') === 0) {
      const getJenis = db.prepare('SELECT id FROM jenis_instrumen WHERE nama = ?');
      const ins = db.prepare('INSERT INTO lembaga (jenis_id, nama, singkatan) VALUES (?, ?, ?)');
      for (const [jenis, list] of Object.entries(SEED.lembaga)) {
        const j = getJenis.get(jenis);
        if (j) list.forEach(([n, s]) => ins.run(j.id, n, s));
      }
    }
    if (count('instrumen_penyimpanan') === 0) {
      const ins = db.prepare('INSERT INTO instrumen_penyimpanan (nama, keterangan) VALUES (?, ?)');
      SEED.penyimpanan.forEach((p) => ins.run(...p));
    }
    if (count('users') === 0) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const info = db.prepare('INSERT INTO users (username, password_hash, nama_lengkap, role) VALUES (?, ?, ?, ?)')
        .run(username, bcrypt.hashSync(password, 10), 'Administrator', 'admin');
      console.log(`[seed] Admin dibuat: ${username} (segera ganti kata sandinya)`);

      if (process.env.SEED_DEMO !== '0') seedDemo(info.lastInsertRowid);
    }
  })();
}

// Contoh data sesuai gambar yang dikirim (bisa dihapus dari aplikasi)
function seedDemo(userId) {
  const id = (sql, v) => (db.prepare(sql).get(v) || {}).id;
  const jenis = id('SELECT id FROM jenis_instrumen WHERE nama = ?', 'E-Wallet');
  const gopay = id('SELECT id FROM lembaga WHERE nama = ?', 'GoPay');
  const kantong = id('SELECT id FROM instrumen_penyimpanan WHERE nama = ?', 'Kantong');
  if (jenis && gopay && kantong) {
    db.prepare('INSERT INTO portofolio (user_id, jenis_id, lembaga_id, penyimpanan_id, nilai) VALUES (?,?,?,?,?)')
      .run(userId, jenis, gopay, kantong, 60000);
  }
  const rows = [
    ['Sukuk Ritel', 'SR019-T5', '2023-11-10', '2028-09-10', 10000000, 6.1],
    ['Sukuk Tabungan', 'ST012-T2', '2024-07-10', '2026-05-10', 10000000, 6.4],
    ['Sukuk Tabungan', 'ST012-T4', '2024-07-10', '2028-05-10', 5000000, 6.55],
    ['Sukuk Ritel', 'SR021-T3', '2024-11-11', '2027-09-10', 5000000, 6.35],
    ['Sukuk Ritel', 'SR021-T5', '2024-11-11', '2029-09-10', 10000000, 6.45],
    ['Sukuk Tabungan', 'ST013-T2', '2025-01-10', '2026-11-10', 10000000, 6.4],
    ['Obligasi Negara Ritel', 'ORI027-T6', '2025-04-15', '2031-02-15', 10000000, 6.75],
    ['Sukuk Tabungan', 'ST014-T4', '2025-06-10', '2029-04-10', 10000000, 6.6],
    ['Sukuk Ritel', 'SR022-T5', '2025-08-11', '2030-06-10', 4000000, 6.55],
    ['Savings Bond Ritel', 'SBR014-T4', '2025-09-10', '2029-08-10', 5000000, 6.35],
  ];
  const ins = db.prepare(`INSERT INTO obligasi (user_id, jenis_obligasi, kode, cair_pertama, cair_terakhir, saldo_awal, kupon)
                          VALUES (?,?,?,?,?,?,?)`);
  rows.forEach((r) => ins.run(userId, ...r));
}

function migrate() {
  const cols = db.prepare('PRAGMA table_info(portofolio)').all();
  if (!cols.find((c) => c.name === 'nama_rekening')) {
    db.exec("ALTER TABLE portofolio ADD COLUMN nama_rekening TEXT NOT NULL DEFAULT ''");
  }
  const cryptoJenis = db.prepare("SELECT id FROM jenis_instrumen WHERE nama = 'Crypto'").get();
  if (!cryptoJenis && db.prepare('SELECT COUNT(*) c FROM jenis_instrumen').get().c > 0) {
    db.prepare('INSERT INTO jenis_instrumen (nama, keterangan) VALUES (?, ?)').run('Crypto', 'Aset kripto / cryptocurrency');
    const cid = db.prepare("SELECT id FROM jenis_instrumen WHERE nama = 'Crypto'").get().id;
    ['Indodax', 'Tokocrypto', 'Pintu'].forEach((name) => {
      const l = db.prepare('SELECT id FROM lembaga WHERE nama = ?').get(name);
      if (l) {
        db.prepare('UPDATE lembaga SET jenis_id = ? WHERE id = ?').run(cid, l.id);
        db.prepare('UPDATE portofolio SET jenis_id = ? WHERE lembaga_id = ?').run(cid, l.id);
      }
    });
    [['Rekeningku', 'Rekeningku'], ['Luno', 'Luno']].forEach(([n, s]) => {
      try { db.prepare('INSERT INTO lembaga (jenis_id, nama, singkatan) VALUES (?, ?, ?)').run(cid, n, s); } catch (e) { /* sudah ada */ }
    });
  }
}

migrate();
seed();

module.exports = { db, DB_FILE };
