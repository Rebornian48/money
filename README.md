# Manajemen Keuangan (Node.js + SQLite)

Web manajemen keuangan pribadi: input aset per instrumen, obligasi (SBN ritel), saham, crypto, gaji PNS, arus kas, tabel master, manajemen pengguna, dan dashboard dengan tabel ringkasan/detail serta diagram pie, doughnut, dan bar.

## Fitur
| Menu | Isi |
|---|---|
| **Dashboard** | Total aset (portofolio + obligasi + saham + crypto), diagram doughnut (komposisi aset), pie (per jenis), bar (per nama instrumen), doughnut + bar bertumpuk untuk obligasi, saham, dan crypto. Tabel ringkasan dan detail. |
| **Input Portofolio** | Tabel gaya spreadsheet: Jenis → Nama → Rekening/Kantong → Penyimpanan → Nilai (Rp). Tersimpan otomatis. |
| **Obligasi** | Jenis, kode, cair pertama/terakhir, saldo awal, keuntungan %/tahun, total proyeksi (otomatis), tahun (otomatis dari tenor kode, mis. `SR019-T5` → 5), status aktif/jatuh tempo. |
| **Saham** | Emiten (kode + nama), sekuritas, tanggal beli, lot, harga beli, harga terkini (bisa diketik langsung di tabel). Otomatis: lembar, modal, nilai pasar, untung/rugi, return %. |
| **Crypto** | Nama aset, simbol, exchange, jumlah, harga beli, harga terkini (inline edit). Otomatis: modal, nilai pasar, untung/rugi, return %. |
| **Gaji PNS** | Slip gaji bulanan (estimasi): gaji pokok, tunjangan kinerja, tunjangan jabatan, potongan (BPJS 1%, Taspen 8%, Tapera 2,5% dari gaji pokok). Riwayat karir & perubahan gaji (CRUD). |
| **Arus Kas** | KPI: total aset (acuan), pendapatan/bulan, pengeluaran/bulan, surplus/defisit. Tanggal pertama gajian → lama bekerja, perkiraan total pendapatan kumulatif, analisis keuangan (pertumbuhan aset/bulan, estimasi pengeluaran riil). Grafik: pendapatan vs pengeluaran, komposisi pendapatan, pengeluaran per kategori. Estimasi pendapatan bulanan & tahunan (gaji + kupon obligasi). Pengeluaran bulanan (CRUD, 11 kategori). |
| **Tabel Master** | Jenis Instrumen, Nama Instrumen, Instrumen Penyimpanan. |
| **Pengguna** (admin) | Nama pengguna, kata sandi (bcrypt), peran admin/user. |

Peran: **admin** mengelola tabel master & pengguna serta bisa melihat data semua pengguna (pilihan "Data milik" di atas). **user** hanya mengelola datanya sendiri.

## Login awal
`admin` / `admin123` — **segera ganti** lewat tombol "Ganti kata sandi", atau atur `ADMIN_USERNAME` dan `ADMIN_PASSWORD` sebelum pertama kali dijalankan.
Akun admin awal sudah berisi contoh data (GoPay–Kantong Rp 60.000 dan 10 seri obligasi). Matikan dengan `SEED_DEMO=0`.

## Menjalankan di komputer
```bash
npm install
npm start          # buka http://localhost:3000
```

## Deploy ke Hostinger (Node.js Web App)
1. Push ke GitHub, lalu hubungkan repo di hPanel → **Websites → Node.js Apps**.
2. Pengaturan build:
   - Node version: **20** atau **22**
   - Build command: `npm install`
   - Entry file: `server.js`
3. **Environment variables**:
   | Nama | Nilai |
   |---|---|
   | `SESSION_SECRET` | teks acak panjang (wajib) |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | akun admin pertama (opsional) |
   | `COOKIE_SECURE` | `1` bila situs memakai HTTPS (disarankan) |
   | `DATA_DIR` | opsional, lokasi database |
   | `SEED_DEMO` | `0` jika tidak ingin contoh data |
4. Klik **Deploy**.

> File `.npmrc` berisi `ignore-scripts=true` agar `better-sqlite3` tidak menjalankan `node-gyp rebuild` di Hostinger (yang tidak memiliki Python). Prebuilt binary (`prebuilds/linux-x64.node`) dimuat otomatis saat runtime.

### Di mana database disimpan?
Hostinger mengganti folder aplikasi setiap kali redeploy, jadi database **tidak** disimpan di folder aplikasi. Defaultnya ada di `~/manajemen-keuangan-data/keuangan.db` (folder home akun hosting) sehingga data aman saat redeploy. Cadangkan file ini secara berkala lewat File Manager.

## Struktur
```
server.js              API Express (auth, master, portofolio, obligasi, saham, crypto, gaji, pengeluaran, pengaturan, dashboard)
db.js                  Skema SQLite + migrasi + data awal
public/index.html      Antarmuka
public/js/app.js       Logika tampilan (Chart.js)
public/css/style.css   Styling
.npmrc                 ignore-scripts untuk Hostinger
```

## Skema tabel
- `users` (id, username, password_hash, nama_lengkap, role)
- `jenis_instrumen` (id, nama, keterangan)
- `lembaga` (id, jenis_id → jenis_instrumen, nama, singkatan)
- `instrumen_penyimpanan` (id, nama, keterangan)
- `portofolio` (id, user_id, jenis_id, lembaga_id, penyimpanan_id, nama_rekening, nilai, catatan)
- `obligasi` (id, user_id, jenis_obligasi, kode, cair_pertama, cair_terakhir, saldo_awal, kupon, lembaga_id, catatan)
- `saham` (id, user_id, emiten_id, sekuritas_id, tanggal_beli, lot, harga_beli, harga_terkini, catatan)
- `crypto` (id, user_id, exchange_id, nama_aset, simbol, jumlah, harga_beli, harga_terkini, catatan)
- `riwayat_gaji` (id, user_id, tanggal, status, dokumen, gaji_pokok, tunjangan_kinerja, tunjangan_jabatan)
- `pengeluaran` (id, user_id, kategori, nama, jumlah, catatan)
- `pengaturan` (user_id, tanggal_pertama_gaji)

Tabel baru dibuat otomatis saat aplikasi dijalankan, jadi database lama tetap aman saat update.
