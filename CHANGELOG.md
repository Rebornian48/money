# Changelog

Semua perubahan penting pada proyek ini didokumentasikan di file ini.

## [Unreleased]

## 2026-10-05

### Ditambahkan
- **Gaji ke-13 dan THR**: otomatis dihitung di tabel perhitungan gaji — Gaji ke-13 di bulan Juni, THR sesuai bulan Idul Fitri. Termasuk dalam kumulatif dan rata-rata pendapatan di Arus Kas.
- **Pendapatan/bulan dari rata-rata kumulatif**: pendapatan di Arus Kas sekarang dihitung dari rata-rata seluruh pembayaran gaji (termasuk Gaji ke-13 & THR), bukan dari gaji terbaru saja.
- **Tabel Perhitungan Gaji Per Bulan**: tabel rinci gaji netto per bulan sejak tanggal pertama gajian, dengan kolom Gaji Pokok, Tunj. Kinerja, Tunj. Jabatan, Bruto, Potongan, Netto, Kumulatif, dan Keterangan. Dilengkapi DataTable (search + pagination).
- **DataTable pada semua tabel data**: search (pencarian teks), pagination (10, 25, 50, semua data per halaman), info jumlah data yang ditampilkan. Diterapkan pada tabel: dashboard (portofolio, obligasi, saham, crypto), obligasi, saham, crypto, gaji (riwayat), arus kas (pengeluaran, per kategori), tabel master (jenis, lembaga, penyimpanan), dan pengguna.

## 2026-10-04

### Ditambahkan
- **Grafik Arus Kas**: bar chart pendapatan vs pengeluaran, doughnut komposisi pendapatan, doughnut pengeluaran per kategori
- **Analisis Keuangan**: hitung pertumbuhan aset/bulan dan estimasi pengeluaran riil dari rasio aset terhadap pendapatan
- **Total Aset sebagai acuan di Arus Kas**: KPI cards menampilkan total aset, pendapatan/bulan, pengeluaran/bulan, surplus/defisit
- **Tanggal Pertama Gajian**: input tanggal, hitung lama bekerja, perkiraan total pendapatan kumulatif, rasio aset/pendapatan
- **Fitur Arus Kas**: estimasi pendapatan bulanan (gaji PNS netto + kupon obligasi), estimasi tahunan, ringkasan bulanan, pengeluaran per kategori
- **Tabel pengeluaran**: CRUD pengeluaran bulanan dengan 11 kategori standar
- **Tabel pengaturan**: simpan tanggal pertama gajian per user
- **API /api/pengeluaran**: CRUD routes untuk pengeluaran bulanan
- **API /api/pengaturan**: GET/PUT untuk pengaturan per user

## 2026-10-03

### Ditambahkan
- **Fitur Gaji PNS**: slip gaji bulanan (gaji pokok, tunjangan kinerja, tunjangan jabatan), potongan otomatis (BPJS 1%, Taspen 8%, Tapera 2,5% dari gaji pokok), riwayat karir & perubahan gaji
- **Tabel riwayat_gaji**: catat setiap perubahan gaji (tanggal, status CPNS/PNS, dokumen, komponen gaji)

### Diperbaiki
- **Cache browser**: tambah cache-busting (`?v=N`) pada CSS/JS di index.html, nonaktifkan cache static file Express (`maxAge: 0, etag: false`)

## 2026-10-02

### Diperbaiki
- **Deploy Hostinger**: tambah `.npmrc` dengan `ignore-scripts=true` agar better-sqlite3 tidak menjalankan `node-gyp rebuild` (Hostinger tidak memiliki Python)

### Ditambahkan
- **Crypto**: section terpisah dengan CRUD, inline edit harga terkini, dashboard crypto (alokasi per aset, modal vs nilai pasar)
- **Kolom rekening/kantong** di portofolio untuk membedakan beberapa rekening di lembaga yang sama

## 2026-10-01

### Ditambahkan
- **Initial release**: dashboard, input portofolio (spreadsheet-style), obligasi SBN ritel, saham, tabel master (jenis, lembaga, penyimpanan), manajemen pengguna (admin/user)
- **Data awal**: 25 bank, 10 e-wallet, 6 KUE, 30 saham, 10 platform investasi, 9 instrumen penyimpanan, 10 seri obligasi demo
- **Deploy**: Node.js + Express + SQLite, database disimpan di luar folder aplikasi untuk keamanan saat redeploy Hostinger
