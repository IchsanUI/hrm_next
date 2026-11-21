# PRD — Pencarian Isi Dokumen Perpustakaan (OCR)

| | |
|---|---|
| **Modul** | Perpustakaan (Peraturan OJK, Peraturan Perusahaan, SOP, Surat Edaran, Lainnya) |
| **Status dokumen** | Tahap 1 & 2 sudah dibangun (21 November 2026) |
| **Tanggal** | 21 November 2026 |
| **Penyusun** | EDP/IT Perumda BPR Bank Gresik |
| **Pemangku kepentingan** | Bagian SDM/HR (pengelola Perpustakaan), Kepatuhan, seluruh pegawai (pembaca), TI |

Dokumen ini menjelaskan fitur pencarian berdasarkan **isi** dokumen Perpustakaan, termasuk dokumen hasil pindaian (scan) yang dibaca dengan OCR. Poin yang masih menunggu keputusan dikumpulkan di **bagian 12**. Setiap poin sudah punya usulan sementara.

---

## 1. Latar Belakang

Saat ini Perpustakaan hanya bisa dicari berdasarkan **judul, nomor dokumen, dan deskripsi**. Pegawai yang mencari aturan tertentu, misalnya "batas maksimum pemberian kredit", "cuti haid", atau "uang makan lembur", harus:

1. menebak dokumen mana yang memuat aturan itu;
2. membuka PDF satu per satu;
3. mencari manual di dalam PDF (Ctrl+F), yang **tidak berfungsi** untuk dokumen hasil scan karena isinya berupa gambar.

Akibatnya:

- pegawai lebih sering bertanya ke HR/Kepatuhan daripada membaca sendiri;
- aturan yang sudah disosialisasikan tetap tidak ditemukan saat dibutuhkan;
- SOP dan Surat Edaran lama yang hanya ada dalam bentuk scan praktis tidak terbaca oleh pencarian.

## 2. Tujuan

1. Pegawai dapat mencari **kata atau frasa di dalam isi dokumen**, bukan hanya judul.
2. Dokumen hasil **scan** ikut bisa dicari melalui OCR (pengenalan teks dari gambar).
3. Hasil pencarian menunjukkan **cuplikan kalimat** dan **nomor halaman**, dan bisa langsung dibuka di halaman tersebut.
4. Proses pembacaan teks berjalan otomatis di latar belakang, tanpa memperlambat unggah dokumen.
5. Seluruh proses berjalan **di server HRIS sendiri**; isi dokumen tidak dikirim ke layanan pihak luar.

### Di luar cakupan

- OCR untuk dokumen pribadi pegawai (KTP, KK, NPWP). Data ini sensitif dan kebutuhannya berbeda.
- Penerjemahan, ringkasan otomatis, atau tanya-jawab berbasis AI atas isi dokumen. Bisa menjadi pengembangan lanjutan (bagian 10).
- Mengubah PDF asli, misalnya menyisipkan lapisan teks ke file. File asli tetap utuh.

## 3. Pengguna & Hak Akses

| Pengguna | Yang dapat dilakukan |
|---|---|
| **Pegawai** | Mencari judul dan isi dokumen yang **terbit**, melihat cuplikan, membuka dokumen di halaman yang cocok. |
| **Admin HR** dengan akses Perpustakaan, dan **Super Admin** | Semua kemampuan pegawai, ditambah melihat status pembacaan teks per dokumen, pratinjau teks hasil OCR, menjalankan ulang OCR, dan mencari dokumen yang belum terbit. |

Pencarian isi **tidak boleh** menampilkan cuplikan dari dokumen yang belum terbit kepada pegawai.

## 4. Cara Kerja

```
Unggah / ganti PDF
      │
      ▼
Antrean pembacaan teks (latar belakang, satu dokumen per waktu)
      │
      ├─ Halaman punya lapisan teks (PDF digital) ──▶ ambil teks langsung (cepat)
      │
      └─ Halaman berupa gambar (scan) ──▶ render jadi gambar ──▶ OCR bahasa Indonesia
      │
      ▼
Teks per halaman disimpan di database + indeks pencarian
      │
      ▼
Pencarian: judul/nomor/deskripsi + isi ──▶ hasil dengan cuplikan & nomor halaman
```

### 4.1 Dua jalur pembacaan teks

| Jenis halaman | Cara | Perkiraan waktu |
|---|---|---|
| PDF digital (diekspor dari Word, unduhan resmi OJK) | Ambil lapisan teks yang sudah ada | < 1 detik per halaman |
| Hasil scan / foto | Render halaman menjadi gambar 300 dpi, lalu OCR | 2–6 detik per halaman (CPU server) |

Sistem memeriksa **setiap halaman**. Halaman yang lapisan teksnya kosong atau terlalu sedikit (mis. < 20 karakter) dianggap scan dan diproses dengan OCR. Dengan begitu, PDF campuran (sebagian digital, sebagian lampiran scan) tetap terbaca seluruhnya.

### 4.2 Status pembacaan per dokumen

| Status | Arti |
|---|---|
| **Menunggu** | Masuk antrean, belum diproses |
| **Dijadwalkan** | Dokumen besar; OCR menunggu jam malam. Contoh tampilan: *"Dijadwalkan malam ini — 64 halaman scan"* |
| **Diproses** | Sedang dibaca; tampil progres "halaman X dari Y" |
| **Selesai** | Seluruh halaman terbaca dan bisa dicari |
| **Sebagian** | Ada halaman yang gagal di-OCR atau melewati batas waktu; halaman lain tetap bisa dicari |
| **Tanpa OCR** | Pengunggah mematikan OCR, atau halaman scan melebihi batas. Hanya halaman digital yang bisa dicari isinya |
| **Gagal** | File tidak bisa dibaca (rusak, terenkripsi/berpassword) |

Selama status belum **Selesai**, dokumen tetap tampil dan tetap bisa dicari berdasarkan judul seperti sekarang.

### 4.3 Kategori ukuran & batas unggah

Ukuran dokumen diukur dari **jumlah halaman scan** (halaman yang perlu di-OCR), bukan ukuran file atau total halaman. Halaman PDF digital hampir tidak membebani server, berapa pun jumlahnya. Jumlah halaman scan diketahui beberapa detik setelah unggah, saat sistem memeriksa lapisan teks tiap halaman.

| Kategori | Halaman scan | Perkiraan waktu OCR (1 thread) | Perlakuan |
|---|---|---|---|
| Kecil | 1–20 | ±1–2 menit | Diproses langsung, juga di jam kerja |
| Sedang | 21–50 | ±2–5 menit | Diproses langsung bila tidak ada dokumen lain yang sedang di-OCR; jika ada, menunggu giliran |
| Besar | 51–300 | ±5–30 menit | **Dijadwalkan** pada jam malam |
| **Terlalu besar** | **> 300** | — | **Tidak bisa di-OCR.** Admin memilih: pecah file, atau unggah **tanpa OCR** (bagian 4.6) |

Selain itu ada batas **total halaman** (digital + scan) **1.000 halaman** per file, dan batas ukuran file tetap **10 MB**. File yang melewati salah satu batas ini **selalu ditolak**, dengan atau tanpa OCR.

**Pesan untuk file > 300 halaman scan** dibuat otomatis dengan saran jumlah bagian dan rentang halaman, misalnya:

> File ini berisi **412 halaman scan** (batas OCR 300). Pilih salah satu:
> - Pecah menjadi **2 bagian**, misalnya halaman **1–206** dan **207–412**, lalu unggah sebagai *Bagian 1* dan *Bagian 2* agar isinya bisa dicari.
> - Simpan ulang hasil scan sebagai **PDF yang bisa dicari** (*searchable PDF*) dari aplikasi scanner.
> - Unggah **tanpa OCR**: dokumen tetap bisa dibaca dan dicari berdasarkan judul, tetapi isi halaman scan tidak ikut dicari.

Jumlah bagian = pembulatan ke atas (halaman scan ÷ batas), dan rentangnya dibagi rata. Pemeriksaan dilakukan **sebelum** file disimpan, sehingga file yang ditolak tidak memakan ruang dan tidak masuk antrean.

### 4.4 Pengaturan Perpustakaan (Super Admin)

Batas di atas tidak ditulis mati di kode. Super Admin dapat mengubahnya di **Pengaturan Perpustakaan** setelah melihat beban nyata server:

| Pengaturan | Bawaan | Rentang yang diizinkan |
|---|---|---|
| OCR aktif | Ya (Tahap 2) | Ya / Tidak. Jika Tidak, halaman scan tidak diproses dan dokumen berstatus *Sebagian* |
| Batas OCR langsung (kecil) | 20 halaman scan | 0–100 |
| Batas OCR langsung (sedang) | 50 halaman scan | ≥ batas kecil, maks. 150 |
| Batas maksimal halaman scan | 300 | 50–500 |
| Batas maksimal total halaman | 1.000 | 100–2.000 |
| Jam malam pemrosesan | 18.00–06.00 | Jam mulai dan jam selesai |
| Batas waktu OCR per halaman | 60 detik | 30–180 detik |

Perubahan pengaturan tercatat di Log Aktivitas, sama seperti Kebijakan Keamanan.

### 4.5 Dokumen yang dipecah menjadi beberapa bagian

Supaya dokumen yang dipecah tetap terasa satu dokumen bagi pegawai:

- Saat mengunggah, admin dapat menandai dokumen sebagai **bagian dari dokumen lain**: memilih dokumen induk (Bagian 1) dan mengisi nomor bagian, mis. *Bagian 2 dari 3*.
- Judul, kategori, nomor, dan tanggal berlaku mengikuti Bagian 1, jadi admin cukup mengisinya sekali.
- Di Perpustakaan pegawai, semua bagian tampil sebagai **satu kartu** dengan tombol **Bagian 1 · Bagian 2 · Bagian 3**.
- Hasil pencarian menyebut lokasinya, mis. *"Bagian 2 · Hal. 15"*.
- Jejak baca dihitung per dokumen induk: pegawai dianggap sudah membaca setelah membuka salah satu bagian. Rincian per bagian tetap tersimpan.
- Menghapus Bagian 1 meminta konfirmasi karena ikut menghapus bagian lainnya.

### 4.6 Pilihan OCR saat unggah (per dokumen)

Form unggah memiliki toggle **Baca teks hasil scan (OCR)**, sehingga pengunggah dapat memutuskan sendiri apakah dokumen ini perlu di-OCR.

Di bawah toggle ada penjelasan singkat:

> OCR membaca teks dari halaman hasil scan agar isinya bisa dicari. Prosesnya **memberatkan server** (±2–6 detik per halaman), jadi matikan bila isi dokumen tidak perlu dicari, mis. lampiran formulir atau gambar.

Perilaku toggle mengikuti hasil pemeriksaan file:

| Hasil pemeriksaan | Toggle | Keterangan yang tampil |
|---|---|---|
| Tidak ada halaman scan (PDF digital) | Disembunyikan | *"PDF digital — isi langsung bisa dicari, tanpa OCR."* |
| 1–50 halaman scan | **Aktif** (bisa dimatikan) | *"35 halaman scan · OCR ±3 menit."* |
| 51–300 halaman scan | **Aktif** (bisa dimatikan) | *"120 halaman scan · OCR dijadwalkan malam ini (±12 menit)."* |
| > 300 halaman scan | **Mati dan terkunci** | Pesan pecah file di bagian 4.3. Admin tetap bisa menekan Simpan untuk mengunggah tanpa OCR |
| OCR dinonaktifkan Super Admin (bagian 4.4) | **Mati dan terkunci** | *"OCR sedang dinonaktifkan oleh Super Admin."* |

Jika dokumen diunggah **tanpa OCR**:

- Teks dari halaman digital (jika ada) tetap diambil dan bisa dicari, karena prosesnya ringan.
- Halaman scan tidak diproses, dan dokumen berstatus **Tanpa OCR**, dengan label *"Isi halaman scan tidak dapat dicari"*.
- Admin dapat menyalakan OCR belakangan lewat tombol **Jalankan OCR** di daftar dokumen, selama jumlah halaman scan ≤ batas. Dokumen akan masuk antrean atau jadwal malam seperti biasa.
- Pilihan ini tercatat di Log Aktivitas, misalnya *"mengunggah X tanpa OCR (412 halaman scan)"*.

## 5. Pengalaman Pengguna

### 5.1 Pegawai — halaman Perpustakaan

- Kotak pencarian yang sama, dengan pilihan **Judul** / **Judul & Isi** (bawaan: Judul & Isi).
- Pencarian isi dijalankan di server setelah pegawai berhenti mengetik (±400 ms) atau menekan Enter, dengan minimal 3 karakter.
- Hasil dikelompokkan per dokumen:
  - kartu dokumen seperti sekarang (judul, kategori, nomor, tanggal berlaku);
  - hingga **3 cuplikan** kalimat yang memuat kata yang dicari, dengan kata tersebut **ditebalkan**, beserta label **"Hal. 12"**;
  - tautan "+N kecocokan lain" bila lebih dari 3.
- Mengklik cuplikan membuka pembaca dokumen **langsung di halaman tersebut**.
- Urutan hasil: kecocokan di judul/nomor lebih dulu, lalu berdasarkan relevansi isi.
- Pencarian frasa persis dengan tanda kutip, mis. `"cuti haid"`.
- Tampilan HP: cuplikan dipotong 2 baris, label halaman tetap terlihat.

### 5.2 Pembaca dokumen

- Membuka di halaman yang dipilih (parameter `#page=N` pada penampil PDF browser).
- Pita kecil di atas pembaca: *"Hasil pencarian 'cuti haid' — halaman 12, 15, 31"* dengan tombol pindah antarhalaman yang cocok.
- Penyorotan kata di dalam PDF **tidak** termasuk versi pertama, karena penampil PDF bawaan browser tidak mendukungnya. Lihat bagian 10.

### 5.3 Admin — Kelola Perpustakaan

- Kolom **Status Teks** pada daftar dokumen: Menunggu / Diproses (x/y) / Selesai / Sebagian / Gagal, plus jumlah halaman hasil OCR.
- Tombol **Lihat Teks** untuk memeriksa hasil pembacaan per halaman, dengan penanda halaman hasil OCR dan tingkat keyakinannya.
- Tombol **Baca Ulang** untuk menjalankan ulang (mis. setelah pengaturan OCR diperbaiki), dan **Jalankan OCR** untuk dokumen berstatus *Tanpa OCR* yang memenuhi batas.
- Halaman dengan keyakinan OCR rendah (mis. < 60%) diberi tanda supaya admin bisa mengganti file dengan scan yang lebih jelas.
- Ringkasan di atas daftar: *"48 dokumen dapat dicari isinya · 2 dalam antrean · 1 dijadwalkan malam · 1 gagal"*.
- Saat memilih file di form unggah, sistem langsung memeriksa dan menampilkan *"120 halaman · 35 halaman scan · OCR ±3 menit"*, atau pesan penolakan (bagian 4.3) sebelum admin menekan Simpan.

## 6. Kebutuhan Fungsional

| ID | Kebutuhan |
|---|---|
| F-01 | Setiap PDF yang diunggah atau diganti otomatis masuk antrean pembacaan teks. |
| F-02 | Halaman dengan lapisan teks dibaca langsung; halaman tanpa teks dibaca dengan OCR bahasa Indonesia (dengan bahasa Inggris sebagai cadangan untuk istilah asing). |
| F-03 | Teks disimpan **per halaman** beserta sumbernya (lapisan teks / OCR) dan tingkat keyakinan OCR. |
| F-04 | Pembacaan berjalan di latar belakang, satu dokumen per waktu, dan tetap berlanjut setelah server di-restart (antrean tersimpan di database). |
| F-05 | Pencarian menggabungkan judul, nomor, deskripsi, dan isi, lalu mengembalikan cuplikan dan nomor halaman. |
| F-06 | Pegawai hanya mendapat hasil dari dokumen terbit; admin dapat memilih menyertakan dokumen belum terbit. |
| F-07 | Mengklik hasil membuka pembaca di halaman yang cocok, dengan navigasi antarhalaman yang cocok. |
| F-08 | Admin dapat melihat status, pratinjau teks per halaman, dan menjalankan ulang pembacaan. |
| F-09 | Mengganti file menghapus teks lama dan membaca ulang; menghapus dokumen ikut menghapus teksnya. |
| F-10 | Dokumen yang sudah ada sebelum fitur ini dibaca otomatis sekali (backfill) setelah rilis. |
| F-11 | Pembacaan teks dan pencarian tidak mengirim isi dokumen ke layanan pihak luar. |
| F-12 | Unggah ulang, baca ulang, dan kegagalan pembacaan tercatat di Log Aktivitas. |
| F-13 | File dengan total halaman melebihi batas (bawaan 1.000) ditolak sebelum disimpan. File dengan halaman scan melebihi batas OCR (bawaan 300) tidak dapat di-OCR: sistem menyarankan jumlah bagian dan rentang halaman, tetapi tetap mengizinkan unggah tanpa OCR. |
| F-14 | Dokumen besar (bawaan > 50 halaman scan) dijadwalkan ke jam malam; dokumen kecil dan sedang diproses langsung. |
| F-15 | Batas halaman, jam malam, batas waktu per halaman, dan aktif/nonaktif OCR dapat diatur Super Admin. |
| F-16 | Dokumen dapat ditautkan sebagai beberapa bagian dan tampil sebagai satu kartu bagi pegawai. |
| F-17 | Form unggah memiliki toggle OCR per dokumen beserta penjelasan beban server. Toggle terkunci mati bila halaman scan > batas atau OCR dinonaktifkan Super Admin. Dokumen tanpa OCR dapat di-OCR belakangan bila memenuhi batas. |

## 7. Kebutuhan Non-Fungsional

- **Kinerja pencarian:** hasil tampil < 1 detik untuk koleksi hingga ±2.000 dokumen / 100.000 halaman.
- **Beban server:** server produksi (4 inti CPU, RAM 5,8 GB dengan ±3,6 GB tersedia) dipakai bersama layanan lain yang lebih kritis, antara lain virtual account dan topup. Karena itu OCR wajib:
  - memakai **satu thread** (`OMP_THREAD_LIMIT=1`), sehingga maksimal 1 dari 4 inti;
  - berjalan dengan prioritas terendah (`nice -n 19`);
  - memproses satu halaman dalam satu waktu (±100–300 MB RAM sesaat);
  - menjadwalkan dokumen besar dan backfill ke jam malam (bagian 4.3).

  Container `app` juga diberi batas sumber daya di `docker-compose.yml` (usulan `cpus: "2"`, memori 1,5 GB), supaya lonjakan HRIS tidak mengganggu container lain.
- **Ukuran:** batas unggah tetap 10 MB per PDF, dengan maksimal 300 halaman scan dan 1.000 halaman total (dapat diatur, bagian 4.4).
- **Akurasi:** untuk scan yang jelas (300 dpi, tidak miring), target ≥ 95% kata terbaca benar. Kualitas scan buruk akan menurunkan hasil, dan admin diberi tanda untuk menggantinya.
- **Penyimpanan:** teks per halaman rata-rata 2–4 KB. 100.000 halaman ≈ 300 MB di database, ikut backup harian dan proses Arsip Data seperti tabel lain.

## 8. Kriteria Penerimaan

1. PDF digital yang baru diunggah dapat dicari isinya dalam ≤ 1 menit.
2. PDF scan 20 halaman dapat dicari isinya dalam ≤ 5 menit setelah diunggah, ketika antrean kosong.
3. Mencari kata yang hanya ada di halaman 12 sebuah dokumen scan menampilkan dokumen itu dengan cuplikan berlabel "Hal. 12". Mengkliknya membuka halaman 12.
4. Pegawai tidak pernah melihat cuplikan dari dokumen yang belum terbit, baik lewat halaman maupun API pencarian.
5. Mengganti file dokumen membuat cuplikan lama hilang dan cuplikan baru muncul setelah pembacaan selesai.
6. Restart container saat OCR berjalan tidak menghilangkan antrean; proses dilanjutkan.
7. PDF berpassword atau rusak berstatus *Gagal* dengan alasan yang jelas, tanpa menghentikan antrean dokumen lain.
8. Selama OCR berjalan, waktu muat halaman HRIS lainnya tidak bertambah signifikan (< 20%), dan pemakaian CPU container HRIS tidak melewati batas yang ditetapkan.
9. Unggahan dengan 412 halaman scan menampilkan saran 2 bagian (hal. 1–206 dan 207–412) dengan toggle OCR terkunci mati. Jika admin tetap menyimpan, dokumen tersimpan berstatus *Tanpa OCR* dan tidak ada proses OCR yang berjalan.
10. Dokumen 64 halaman scan yang diunggah pukul 10.00 berstatus *Dijadwalkan* dan baru diproses setelah jam malam dimulai.
11. Tiga bagian dokumen tampil sebagai satu kartu bagi pegawai, dan hasil pencarian menyebut nomor bagian dan halamannya.
12. Dokumen scan 30 halaman yang diunggah dengan toggle OCR dimatikan tidak memicu OCR sama sekali, dan dapat di-OCR belakangan lewat tombol **Jalankan OCR**.

## 9. Catatan Teknis untuk TI

- **Mesin OCR:** Tesseract 5 dengan data bahasa `ind` + `eng`, dipasang di image Docker. Render halaman dengan `pdftoppm` (poppler-utils), dan ambil lapisan teks dengan `pdftotext`. Usulan tambahan di `.docker/app/Dockerfile` (stage runner):

  ```
  apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng poppler-utils
  ```

  Tambahannya ±60–80 MB pada image. Alternatif tanpa paket sistem adalah `tesseract.js` (WASM), tetapi 2–3× lebih lambat. Lihat bagian 12.
- **Data:**
  - Tabel baru `library_document_pages`: `documentId`, `pageNumber`, `text` (LONGTEXT), `source` (TEXT_LAYER/OCR), `confidence`, dengan indeks `FULLTEXT(text)` (InnoDB MariaDB 10.11).
  - Kolom baru di `library_documents`: `textStatus`, `textProgress`, `textError`, `textExtractedAt`, `searchableTitle`.
- **Pencarian:**
  - `MATCH ... AGAINST` mode boolean untuk kata kunci dan frasa bertanda kutip.
  - Cuplikan dibuat di server: potongan ±160 karakter di sekitar kecocokan pertama per halaman.
  - Batas minimum token FULLTEXT InnoDB adalah 3 karakter (`innodb_ft_min_token_size`). Kata 1–2 huruf diabaikan, cukup diberi petunjuk di UI.
  - Normalisasi teks OCR: gabungkan kata yang terpotong tanda hubung di akhir baris, rapikan spasi.
- **Antrean:** memakai tabel status di atas, diproses oleh worker di dalam proses Next.js (dijalankan dari `instrumentation.ts`, seperti penjadwal yang sudah ada) dengan kunci baris agar satu dokumen tidak diproses ganda. Proses OCR dijalankan sebagai child process dengan batas waktu per halaman (mis. 60 detik).
- **Penyimpanan sementara:** gambar halaman dirender ke folder `tmp` dan dihapus segera setelah di-OCR.
- **Keamanan:**
  - Endpoint pencarian memakai sesi login dan memfilter `isPublished` untuk pegawai.
  - Teks hasil OCR diperlakukan sama sensitifnya dengan dokumen asli dan tidak diekspos tanpa login.
  - Pemindaian malware yang sudah ada tetap berjalan sebelum file diproses.
- **Pemakaian ulang:** `lib/library-storage.ts` (lokasi file), `logActivity`, pola penjadwal di `instrumentation.ts`, dan komponen `library-browser.tsx`.

## 10. Tahapan Rilis

| Tahap | Isi | Alasan urutan |
|---|---|---|
| **1** | Ambil lapisan teks PDF digital, tabel teks per halaman, pencarian isi dengan cuplikan dan nomor halaman, buka di halaman, status di admin, backfill dokumen lama, **pemeriksaan & batas halaman saat unggah, Pengaturan Perpustakaan, dan Bagian dokumen** | Sebagian besar peraturan OJK dan dokumen internal baru berupa PDF digital, jadi manfaatnya langsung terasa tanpa OCR. Batas halaman dipasang sejak awal agar file raksasa tidak masuk |
| **2** | OCR untuk halaman scan (Tesseract + poppler di image Docker), tingkat keyakinan, pratinjau teks, Baca Ulang, penjadwalan jam malam, batas sumber daya container | Butuh perubahan image dan uji beban CPU di server produksi. Bisa ditunda bila dokumen scan baru dibiasakan diunggah sebagai *searchable PDF* |
| **3** (opsional) | Penampil PDF sendiri (pdf.js) dengan penyorotan kata di dalam halaman; pencarian lintas modul (mis. ikut mencari di surat Administrasi SDM); ringkasan/tanya-jawab isi dokumen | Peningkatan kenyamanan, tidak wajib untuk tujuan utama |

## 11. Dampak ke Fitur Lain

- **Perpustakaan (pegawai & admin):** kotak pencarian, daftar hasil, pembaca dokumen, dan daftar kelola dokumen berubah.
- **Docker image:** bertambah paket OCR (Tahap 2); waktu build sedikit lebih lama.
- **Backup & Arsip Data:** tabel teks ikut dibackup, sehingga ukuran backup bertambah sesuai jumlah halaman.
- **Monitoring Penyimpanan:** tambahkan ukuran tabel teks Perpustakaan ke rincian per modul.
- **Pusat Bantuan:** tambah pertanyaan "Bagaimana mencari isi peraturan?" dan "Kenapa dokumen saya belum bisa dicari isinya?".

## 12. Pertanyaan untuk Review

| No. | Keputusan yang dibutuhkan | Usulan awal |
|---|---|---|
| 1 | Apakah fitur ini hanya untuk Perpustakaan, atau juga modul lain (mis. lampiran SOP di modul lain, surat Administrasi SDM)? | Perpustakaan dulu; modul lain di Tahap 3. |
| 2 | Mesin OCR: Tesseract sistem (lebih cepat, image +±70 MB) atau tesseract.js (tanpa paket sistem, lebih lambat)? | Tesseract sistem. |
| 3 | Kapan dokumen scan besar diproses? | ≤ 20 halaman scan langsung; 21–50 langsung bila antrean kosong; 51–300 pukul 18.00–06.00; > 300 ditolak. Semua dapat diubah Super Admin. |
| 4 | Apakah pegawai boleh melihat cuplikan dari dokumen kategori tertentu yang bersifat terbatas? | Semua dokumen terbit boleh dicari pegawai, sama seperti hak baca saat ini. Bila ada dokumen terbatas, perlu fitur hak baca per dokumen terlebih dahulu. |
| 5 | Berapa jumlah dan perkiraan halaman dokumen yang ada sekarang, dan berapa yang berupa scan? | Perlu didata pengelola Perpustakaan untuk memperkirakan lama backfill. |
| 6 | Apakah admin perlu bisa **mengoreksi** teks hasil OCR secara manual? | Tidak di versi ini; cukup ganti file dengan scan yang lebih jelas. |
| 7 | Apakah riwayat kata kunci pencarian dicatat (untuk melihat aturan yang paling sering dicari)? | Ya, anonim (kata kunci + jumlah hasil, tanpa nama pegawai), ditampilkan ke admin sebagai "Pencarian populer" dan "Pencarian tanpa hasil". |
| 8 | Apakah pengelola Perpustakaan bersedia membiasakan scan sebagai *searchable PDF* (OCR di komputer scanner)? | Ya. Dengan itu OCR di server (Tahap 2) hanya diperlukan untuk dokumen scan lama. |
| 9 | Siapa yang boleh mengubah Pengaturan Perpustakaan? | Super Admin saja; Admin HR hanya melihat batas yang berlaku di form unggah. |

---

## 13. Acuan

- Modul Perpustakaan HRIS: `app/pegawai/perpustakaan`, `app/admin/perpustakaan`, `components/library-browser.tsx`, `lib/library-storage.ts`.
- Tesseract OCR 5, data bahasa `ind` (Bahasa Indonesia) dan `eng`.
- MariaDB 10.11: InnoDB FULLTEXT search (mode boolean, `innodb_ft_min_token_size`).
