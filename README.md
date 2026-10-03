# Manajemen Keuangan (Node.js + SQLite)

Web manajemen keuangan pribadi: input aset per instrumen, obligasi (SBN ritel), tabel master, manajemen pengguna, dan dashboard dengan tabel ringkasan/detail serta diagram pie, doughnut, dan bar.

## Fitur
| Menu | Isi |
|---|---|
| **Dashboard** | Total aset, portofolio, obligasi aktif, proyeksi keuntungan. Diagram doughnut (komposisi aset), pie (per jenis), bar (per nama instrumen), doughnut + bar bertumpuk untuk obligasi. Tabel ringkasan dan detail. |
| **Input Portofolio** | Tabel gaya spreadsheet: Jenis Instrumen Keuangan → Nama Instrumen Keuangan → Instrumen Investasi/Penyimpanan → Nilai (Rp). Tersimpan otomatis. |
| **Obligasi** | Jenis, kode, cair pertama/terakhir, saldo awal, keuntungan %/tahun, total proyeksi (otomatis), tahun (otomatis dari tenor kode, mis. `SR019-T5` → 5), status aktif/jatuh tempo. |
| **Saham** | Emiten (kode + nama), sekuritas, tanggal beli, lot, harga beli, harga terkini (bisa diketik langsung di tabel). Otomatis: lembar, modal, nilai pasar, untung/rugi, return %. |
| **Jenis Instrumen** | E-Wallet, Bank, KUE (+ Saham, Platform Investasi). |
| **Nama Instrumen** | 25 bank, 10 e-wallet, 6 KUE, 30 saham (nama + kode), 10 platform investasi. |
| **Instrumen Penyimpanan** | Kantong, Tabungan, Deposito, Saham, Obligasi, Reksa Dana, Emas, Kripto, Giro. |
| **Pengguna** (admin) | Nama pengguna, kata sandi (bcrypt), peran admin/user. |

Peran: **admin** mengelola tabel master & pengguna serta bisa melihat data semua pengguna (pilihan "Data milik" di atas). **user** hanya mengelola datanya sendiri.

## Login awal
`admin` / `admin123` — **segera ganti** lewat tombol "Ganti kata sandi", atau atur `ADMIN_USERNAME` dan `ADMIN_PASSWORD` sebelum pertama kali dijalankan.
Akun admin awal sudah berisi contoh data dari gambar (GoPay–Kantong Rp 60.000 dan 10 seri obligasi). Matikan dengan `SEED_DEMO=0`.

## Menjalankan di komputer
```bash
npm install
npm start          # buka http://localhost:3000
```

## Deploy ke Hostinger (Node.js Web App)
1. Zip isi folder ini **tanpa** `node_modules`.
2. hPanel → **Websites → Add Website → Node.js Apps** → *Upload your website files* → unggah zip.
3. Pengaturan build:
   - Node version: **20** atau **22**
   - Build command: `npm install` (atau biarkan default)
   - Entry file: `server.js`
4. **Environment variables**:
   | Nama | Nilai |
   |---|---|
   | `SESSION_SECRET` | teks acak panjang (wajib) |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | akun admin pertama (opsional) |
   | `COOKIE_SECURE` | `1` bila situs memakai HTTPS (disarankan) |
   | `DATA_DIR` | opsional, lokasi database |
   | `SEED_DEMO` | `0` jika tidak ingin contoh data |
5. Klik **Deploy**.

### Di mana database disimpan?
Hostinger mengganti folder aplikasi setiap kali redeploy, jadi database **tidak** disimpan di folder aplikasi. Defaultnya ada di `~/manajemen-keuangan-data/keuangan.db` (folder home akun hosting) sehingga data aman saat redeploy. Cadangkan file ini secara berkala lewat File Manager.

> Jika `better-sqlite3` gagal di-build, pastikan versi Node 20/22 dan lihat *Runtime Logs* di hPanel.

## Struktur
```
server.js          API Express (auth, master, portofolio, obligasi, dashboard)
db.js              Skema SQLite + data awal
public/index.html  Antarmuka
public/js/app.js   Logika tampilan (Chart.js)
public/css/style.css
```

## Skema tabel
- `users` (id, username, password_hash, nama_lengkap, role)
- `jenis_instrumen` (id, nama, keterangan)
- `lembaga` (id, jenis_id → jenis_instrumen, nama, singkatan)
- `instrumen_penyimpanan` (id, nama, keterangan)
- `portofolio` (id, user_id, jenis_id, lembaga_id, penyimpanan_id, nilai, catatan)
- `obligasi` (id, user_id, jenis_obligasi, kode, cair_pertama, cair_terakhir, saldo_awal, kupon, lembaga_id, catatan)
- `saham` (id, user_id, emiten_id → lembaga, sekuritas_id → lembaga, tanggal_beli, lot, harga_beli, harga_terkini, catatan)

Tabel baru dibuat otomatis saat aplikasi dijalankan, jadi database lama tetap aman saat update.
