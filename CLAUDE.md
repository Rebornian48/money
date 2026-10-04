# CLAUDE.md

Panduan untuk Claude Code saat bekerja di repositori ini.

## Tentang proyek
Aplikasi web manajemen keuangan pribadi (single-page app) menggunakan Node.js + Express + SQLite (better-sqlite3) + Chart.js. Ditujukan untuk PNS yang ingin mengelola aset, obligasi, saham, crypto, gaji, dan arus kas.

## Teknologi
- **Backend**: Node.js, Express, better-sqlite3, cookie-session, bcryptjs
- **Frontend**: Vanilla JS (single file `app.js`), Chart.js (dari `node_modules/chart.js/dist`), CSS custom
- **Database**: SQLite (WAL mode, foreign keys ON), disimpan di `~/manajemen-keuangan-data/keuangan.db`
- **Deploy**: Hostinger Node.js hosting, auto-deploy dari GitHub

## Arsitektur
- `server.js` — semua API route Express (auth, CRUD untuk setiap entitas, dashboard aggregation)
- `db.js` — skema tabel (CREATE TABLE IF NOT EXISTS), migrasi (ALTER TABLE), seed data awal
- `public/js/app.js` — semua logika frontend dalam satu file (state management, views, chart rendering)
- `public/index.html` — single HTML dengan nav sidebar, modal dialog, toast notification
- `public/css/style.css` — responsive CSS dengan CSS variables

## Pola kode
- Setiap entitas di backend mengikuti pola: SQL query, FIELDS array, valid() function, owned() function, CRUD routes
- Frontend menggunakan object `VIEWS` dengan key = nama view, value = async function yang merender ke `#view` div
- Cache-busting menggunakan query parameter `?v=N` di index.html (bump saat mengubah CSS/JS)
- Inline editing di tabel (harga saham/crypto) langsung PATCH ke API

## Perintah
```bash
npm install        # install dependencies
npm start          # jalankan server di port 3000
node server.js     # sama dengan npm start
```

## Deployment
- `.npmrc` berisi `ignore-scripts=true` agar better-sqlite3 tidak menjalankan node-gyp rebuild
- Prebuilt binary (`prebuilds/linux-x64.node`) dimuat otomatis oleh `lib/binding.js`
- Setelah push ke main, Hostinger auto-deploy

## Konvensi
- Bahasa Indonesia untuk UI, nama variabel backend boleh campur bahasa Inggris
- Commit message dalam bahasa Indonesia
- Bump cache version (`?v=N`) setiap kali mengubah `app.js` atau `style.css`
- Express static file serving: `maxAge: 0, etag: false` untuk mencegah cache di development
- Gunakan `wrap()` helper untuk error handling di route handler
- Gunakan `targetUser(req)` untuk mendukung admin melihat data user lain
