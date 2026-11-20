# PRD — Administrasi SDM (HR Administration)

| | |
|---|---|
| **Modul** | Administrasi SDM (Surat Keterangan Kerja, Surat Peringatan, Perjanjian Kerja) |
| **Status dokumen** | Draf 1 untuk ditinjau |
| **Tanggal** | 20 November 2026 |
| **Penyusun** | EDP/IT Perumda BPR Bank Gresik |
| **Pemangku kepentingan** | Bagian SDM/HR, Direksi (penandatangan), Kepala Bagian/atasan, pegawai, Kepatuhan/Legal, TI |

Dokumen ini menjelaskan fitur yang akan dibangun. Saat ini menu HR
Administration di HRIS baru berupa halaman rencana yang hanya bisa dilihat
SuperAdmin. Poin yang masih menunggu keputusan dikumpulkan di **bagian 12**.
Setiap poin sudah punya usulan sementara, jadi tidak ada yang menghambat
pembangunan Tahap 1.

---

## 1. Latar Belakang

Saat ini surat-surat kepegawaian disusun manual di pengolah kata:

1. Data pegawai (nama, NIP, jabatan, bagian, tanggal masuk) diketik ulang
   setiap kali membuat surat.
2. Nomor surat diambil dari buku agenda terpisah.
3. Draf diedarkan untuk dibaca dan disetujui, lalu dicetak dan ditandatangani.
4. Salinan disimpan di map fisik atau folder bersama.

Akibatnya:

- data di surat bisa berbeda dengan data resmi di HRIS (salah jabatan, masa
  kerja keliru);
- nomor surat bisa ganda atau terlewat;
- masa berlaku Surat Peringatan dan berakhirnya kontrak PKWT harus diingat
  manual, padahal keduanya berdampak hukum;
- riwayat surat seorang pegawai sulit dikumpulkan ketika dibutuhkan
  (pemeriksaan, perselisihan, promosi);
- keaslian surat yang dibawa pegawai ke pihak luar sulit diperiksa.

## 2. Tujuan

1. Surat dibuat dari **template resmi** dengan data pegawai yang terisi
   otomatis dari HRIS.
2. **Penomoran otomatis** per jenis surat, tanpa nomor ganda.
3. **Alur persetujuan bisa diatur** per jenis surat tanpa perubahan program,
   seperti Alur Approval Izin.
4. Setiap surat yang terbit tersimpan sebagai **arsip PDF yang tidak bisa
   diubah**, dan masuk ke riwayat pegawai serta Cetak PDF Dossier.
5. Masa berlaku SP dan masa akhir kontrak **dipantau sistem**, dengan
   pengingat ke HR sebelum jatuh tempo.
6. Keaslian surat bisa diperiksa lewat **kode QR**.
7. Seluruh tindakan tercatat di Log Aktivitas.

**Di luar cakupan versi ini:**
- tanda tangan elektronik tersertifikasi (PSrE) dan e-meterai;
- proses PHK, perhitungan pesangon, dan uang kompensasi PKWT;
- surat jenis lain (SK pengangkatan, mutasi, promosi), yang bisa menyusul
  memakai fondasi yang sama;
- pengiriman surat ke pihak luar lewat email.

## 3. Fondasi Bersama

Ketiga modul memakai fondasi yang sama. Fondasi ini dibangun sekali di Tahap 1.

### 3.1 Template surat

- Setiap jenis surat punya template isi yang diatur HR di **Pengaturan HR
  Administration**.
- Template memakai isian otomatis, misalnya `{nama}`, `{nip}`, `{jabatan}`,
  `{bagian}`, `{status_kepegawaian}`, `{tanggal_masuk}`, `{masa_kerja}`,
  `{tanggal_surat}`, dan `{nomor_surat}`.
- Kop surat memakai kop resmi yang sudah ada di Pengaturan Izin, dengan
  pilihan kop khusus per jenis surat.
- Isi template untuk Perjanjian Kerja dan Surat Peringatan **wajib disetujui
  Kepatuhan/Legal** sebelum dipakai. Perubahan template tidak mengubah surat
  yang sudah terbit.

### 3.2 Penomoran

- Format nomor per jenis surat, mengikuti cara Nota Dinas Klaim Kesehatan.
  Contoh: `{nomor}/SKK/SDM/{bulan_romawi}/{tahun}`.
- Urutan `{nomor}` berjalan per jenis surat per tahun, dan **baru diambil saat
  surat diterbitkan**, bukan saat draf dibuat. Dengan begitu draf yang batal
  tidak menghabiskan nomor.
- Nomor tidak pernah dipakai ulang. Surat yang dibatalkan tetap tercatat
  dengan nomornya dan status *Dibatalkan*.

### 3.3 Alur persetujuan

- Diatur per jenis surat di Alur Approval. Contoh: Kepala Bagian → HR →
  Direksi.
- Setiap langkah bisa **Setujui**, **Kembalikan untuk diperbaiki** (dengan
  alasan), atau **Tolak** (dengan alasan). Semuanya tampil di riwayat surat.
- Penandatangan surat ditentukan di pengaturan per jenis surat, misalnya
  Direktur Utama atau Kepala Bagian SDM. Gambar TTD diambil dari data TTD
  pegawai yang sudah ada, dan baru ditempelkan setelah langkah terakhir
  disetujui.

### 3.4 Status surat

`Draf` → `Menunggu Persetujuan` → `Diterbitkan` → (`Diterima Pegawai`)

Status lain: `Dikembalikan`, `Ditolak`, `Dibatalkan`.

- Surat yang sudah **Diterbitkan tidak bisa diedit**. Koreksi dilakukan dengan
  membatalkan surat (wajib dengan alasan) lalu menerbitkan surat pengganti
  yang merujuk ke nomor lama.

### 3.5 Arsip, verifikasi, dan riwayat

- Saat diterbitkan, sistem menyimpan **satu file PDF final**. File yang
  diunduh selalu file yang sama, tidak dibuat ulang dari data terbaru.
- PDF memuat **kode QR verifikasi** yang membuka halaman berisi nomor, jenis,
  tanggal, nama pegawai, dan status surat (sah/dibatalkan). Isi surat tidak
  ditampilkan di halaman ini.
- Setiap surat muncul di tab **Dokumen HR** pada profil pegawai, dan ikut
  dipilih di **Cetak PDF Dossier**.
- Pegawai melihat dan mengunduh surat miliknya sendiri lewat menu **Dokumen
  Saya** di portal pegawai.

### 3.6 Hak akses

| Peran | Akses |
|---|---|
| **SuperAdmin** | Semua fitur dan pengaturan. |
| **HR Admin** dengan akses menu Administrasi SDM | Membuat, memproses, menerbitkan, dan membatalkan surat; mengatur template dan penomoran. |
| **Penyetuju** (Kepala Bagian, Direksi, dll.) | Melihat dan memproses surat yang menunggu persetujuannya di Approval Center. |
| **Pegawai** | Mengajukan Surat Keterangan Kerja, melihat surat miliknya, memberi tanda terima dan tanggapan SP. |

Surat Peringatan bersifat **rahasia**. Hanya HR, penyetuju dalam alurnya, dan
pegawai yang bersangkutan yang bisa melihatnya.

## 4. Modul A — Surat Keterangan Kerja (SKK)

**Kegunaan:** keperluan pegawai di pihak luar, misalnya pengajuan KPR,
pinjaman, visa, atau sekolah anak.

**Jenis:**

| Jenis | Untuk | Isi utama |
|---|---|---|
| Keterangan Masih Bekerja | Pegawai aktif | Nama, NIP, jabatan, bagian, status kepegawaian, tanggal masuk, masa kerja, keperluan |
| Keterangan Pernah Bekerja (paklaring) | Pegawai yang sudah keluar | Nama, NIP, jabatan terakhir, periode bekerja (tanggal masuk–keluar) |

**Alur:**

1. Pegawai mengajukan dari portal dengan mengisi keperluan dan bahasa
   (Indonesia/Inggris, lihat bagian 12). HR juga bisa membuatkan langsung.
2. HR memeriksa data. Sistem memperingatkan kalau data pegawai belum lengkap.
3. Surat menjalani alur persetujuan, lalu diterbitkan.
4. Pegawai mendapat notifikasi dan mengunduh PDF.

**Ketentuan:**

- **Penghasilan tidak dicantumkan secara bawaan.** Kalau keperluan
  membutuhkan keterangan penghasilan, pegawai mencentang pilihan khusus. Surat
  seperti itu wajib melewati langkah persetujuan tambahan yang ditentukan
  pengaturan.
- Masa kerja dihitung sampai tanggal surat.
- Satu pegawai tidak bisa punya lebih dari satu pengajuan SKK yang masih
  diproses untuk keperluan yang sama.

## 5. Modul B — Surat Peringatan (SP)

**Tingkat:** SP I, SP II, SP III. Teguran tertulis ditambahkan bila
Peraturan Perusahaan mengaturnya (lihat bagian 12).

**Isi surat:**
- identitas pegawai;
- uraian pelanggaran dan tanggal kejadian;
- pasal Peraturan Perusahaan yang dilanggar;
- tingkat SP dan masa berlakunya;
- konsekuensi bila pelanggaran berulang.

**Alur:**

1. **Usulan.** Kepala Bagian/atasan atau HR membuat usulan SP. Usulan memuat
   uraian pelanggaran dan lampiran bukti, misalnya rekap keterlambatan dari
   modul Absensi yang bisa dilampirkan langsung.
2. **Saran tingkat.** Sistem menyarankan tingkat SP berdasarkan SP yang masih
   berlaku. Contoh: pegawai masih punya SP I aktif, maka sistem menyarankan
   SP II. HR tetap bisa memilih tingkat lain dengan alasan.
3. **Persetujuan.** HR memeriksa, lalu usulan menjalani alur persetujuan
   sampai Direksi.
4. **Penerbitan.** Setelah diterbitkan, pegawai mendapat notifikasi.
5. **Tanda terima.** Pegawai menyatakan **telah menerima** SP di HRIS. Waktu
   konfirmasi dicatat.
6. **Tanggapan.** Pegawai bisa mengisi **tanggapan/pembelaan** dalam jangka
   waktu tertentu (usulan 7 hari).
7. **Penolakan menerima.** Kalau pegawai menolak menerima, HR mencatat
   penyerahan manual beserta saksi.

**Masa berlaku:**

- Bawaan **6 bulan sejak tanggal terbit**, mengikuti PP 35/2021 Pasal 52,
  kecuali Peraturan Perusahaan menetapkan lain. Nilainya diatur di pengaturan.
- Setelah lewat masa berlakunya, status SP otomatis menjadi **Tidak Berlaku**
  dan tidak lagi dihitung dalam saran tingkat.
- HR mendapat pengingat sebelum masa berlaku SP habis.

**Penandaan dan dampak:**

- Profil pegawai menampilkan tanda **SP aktif**. Tanda ini hanya terlihat oleh
  HR dan SuperAdmin.
- **SP III aktif** ditambah usulan SP baru memunculkan peringatan bahwa
  pelanggaran berikutnya masuk ranah proses PHK. Proses PHK sendiri di luar
  sistem ini.
- Dampak ke payroll atau KPI (misalnya pemotongan insentif) **tidak otomatis**
  di versi ini. Dampak tersebut hanya diterapkan kalau ditetapkan kebijakan
  bank (lihat bagian 12).

## 6. Modul C — Perjanjian Kerja

**Jenis:**

| Jenis | Kegunaan |
|---|---|
| PKWT | Perjanjian kerja waktu tertentu (kontrak) |
| Perpanjangan/Pembaruan PKWT | Melanjutkan kontrak, merujuk ke PKWT sebelumnya |
| Pengangkatan PKWTT | Pengangkatan menjadi pegawai tetap |

**Isi surat:**
- identitas para pihak;
- jabatan dan penempatan;
- jangka waktu;
- upah dan komponennya, diambil dari data gaji pegawai;
- hak dan kewajiban;
- pasal-pasal dari template yang disetujui Legal.

**Alur:**

1. HR membuat draf. Sistem mengisi data pegawai dan menghitung **total masa
   PKWT** pegawai tersebut, termasuk kontrak-kontrak sebelumnya.
2. Draf menjalani alur persetujuan, lalu diterbitkan.
3. PDF dicetak dan ditandatangani basah oleh para pihak, dengan meterai bila
   diperlukan.
4. HR **mengunggah hasil pindaian yang sudah ditandatangani**. Status surat
   menjadi **Ditandatangani**, dan file pindaian itu yang menjadi arsip resmi.
5. Saat ditandatangani, sistem menawarkan pembaruan data pegawai:
   - tanggal akhir kontrak;
   - status kepegawaian (untuk PKWTT);
   - catatan di riwayat pekerjaan.

   Perubahan data hanya disimpan setelah HR mengonfirmasi.

**Validasi dan pengingat:**

- Sistem memberi **peringatan** kalau total masa PKWT melebihi batas
  PP 35/2021 Pasal 8, yaitu 5 tahun termasuk perpanjangan. Batas ini perlu
  dikonfirmasi Legal.
- **Pengingat akhir kontrak** dikirim ke HR, dan opsional ke Kepala Bagian,
  pada **60 dan 30 hari** sebelum tanggal akhir. Pengingat meminta keputusan:
  *Perpanjang*, *Angkat tetap*, atau *Tidak diperpanjang*.
- Daftar **kontrak yang akan berakhir** tampil di halaman Administrasi SDM.

## 7. Kebutuhan Fungsional

| ID | Kebutuhan |
|---|---|
| F-01 | HR dapat mengelola template per jenis surat, lengkap dengan isian otomatis dan pratinjau. |
| F-02 | Nomor surat dibuat otomatis per jenis per tahun, diambil saat terbit, dan tidak pernah dipakai ulang. |
| F-03 | Alur persetujuan per jenis surat dapat diatur. Setiap langkah dapat menyetujui, mengembalikan, atau menolak dengan alasan. |
| F-04 | Surat terbit disimpan sebagai PDF final yang tidak dapat diubah, lengkap dengan kode QR verifikasi. |
| F-05 | Surat terbit hanya dapat dikoreksi lewat pembatalan beralasan dan penerbitan surat pengganti. |
| F-06 | Pegawai dapat mengajukan SKK serta melihat dan mengunduh surat miliknya. |
| F-07 | SP memiliki masa berlaku yang dapat diatur, berubah status otomatis setelah lewat, dan menjadi dasar saran tingkat SP berikutnya. |
| F-08 | Pegawai dapat memberi tanda terima dan tanggapan atas SP. HR dapat mencatat penyerahan manual. |
| F-09 | Perjanjian Kerja menghitung total masa PKWT dan memperingatkan bila melampaui batas. |
| F-10 | Pengingat akhir kontrak dan akhir masa berlaku SP dikirim ke HR sesuai jadwal yang diatur. |
| F-11 | Surat terbit tampil di profil pegawai (tab Dokumen HR) dan dapat dipilih di Cetak PDF Dossier. |
| F-12 | Semua tindakan (buat, setujui, kembalikan, tolak, terbitkan, batalkan, unduh) tercatat di Log Aktivitas. |
| F-13 | Akses SP dibatasi untuk HR, penyetuju dalam alur, dan pegawai yang bersangkutan. |

## 8. Kriteria Penerimaan

1. Data pegawai di surat selalu sama dengan data HRIS pada saat surat terbit.
2. Tidak ada dua surat terbit dengan nomor yang sama, termasuk ketika dua
   surat diterbitkan bersamaan.
3. Surat terbit tidak dapat diedit oleh siapa pun. PDF yang diunduh kapan pun
   identik dengan saat terbit.
4. Pemindaian QR surat yang dibatalkan menampilkan status *Dibatalkan*.
5. Pegawai lain dan HR Admin tanpa akses menu tidak dapat membuka SP pegawai
   lain, baik lewat halaman maupun URL unduhan.
6. SP yang lewat masa berlakunya tidak lagi dihitung dalam saran tingkat.
7. Pengingat akhir kontrak muncul 60 dan 30 hari sebelum tanggal akhir.
8. Data pegawai (tanggal akhir kontrak, status kepegawaian) baru berubah
   setelah HR mengonfirmasi.
9. File surat tetap ada setelah container di-rebuild (volume persisten).

## 9. Catatan Teknis untuk TI

- **Pemakaian ulang:**
  - generator nomor dan halaman verifikasi QR dari Nota Dinas Klaim
    Kesehatan (`lib/health-claim-memo.ts`);
  - render PDF berbasis `@react-pdf/renderer`;
  - kop surat dari `IzinSettings.letterheadUrl`;
  - TTD dari `Employee.signatureUrl`;
  - pola alur approval yang sudah ada;
  - `logActivity`, notifikasi, dan Cetak PDF Dossier.
- **Penyimpanan:** PDF final dan pindaian disimpan di luar `public/`, di
  `storage/hr-administration`, dan diunduh lewat route yang memeriksa hak
  akses. Folder ini **wajib ditambahkan sebagai volume** di
  `.docker/docker-compose.yml` dan dibuat di `Dockerfile`, seperti folder
  storage lain.
- **Nomor surat** diambil di dalam transaksi database (penghitung per
  jenis+tahun dengan *row lock*), supaya aman dari penerbitan bersamaan.
- **Pengingat** dijalankan oleh scheduler harian, mengikuti pola pengingat
  sertifikasi (`lib/certification-reminder-scheduler.ts`).
- **Hak akses HR Admin** ditambahkan sebagai kunci menu baru di Manajemen
  Akses HR. Menu tidak lagi khusus SuperAdmin.

## 10. Tahapan Rilis

| Tahap | Isi | Alasan urutan |
|---|---|---|
| **1** | Fondasi bersama (template, penomoran, alur persetujuan, arsip PDF, QR, Dokumen HR/Dokumen Saya) dan **Surat Keterangan Kerja** | Risiko hukum paling rendah dan paling sering diminta pegawai, sehingga cocok untuk menguji fondasi |
| **2** | **Surat Peringatan**: masa berlaku, saran tingkat, tanda terima, dan tanggapan | Butuh template yang disetujui Legal dan kerahasiaan yang sudah teruji |
| **3** | **Perjanjian Kerja**: PKWT, perpanjangan, PKWTT, unggah pindaian bertanda tangan, sinkron data pegawai, dan pengingat akhir kontrak | Paling kompleks dan menyentuh data gaji serta status kepegawaian |

## 11. Dampak ke Fitur Lain

- **Profil pegawai:** tab baru *Dokumen HR*, ditambah tanda *SP aktif* yang
  hanya terlihat HR.
- **Portal pegawai:** menu baru *Dokumen Saya*.
- **Approval Center:** menampilkan surat yang menunggu persetujuan.
- **Cetak PDF Dossier:** pilihan surat HR ikut tersedia.
- **Manajemen Akses HR:** kunci menu baru Administrasi SDM.
- **Docker:** volume baru `storage/hr-administration`.

## 12. Pertanyaan untuk Review

| No. | Keputusan yang dibutuhkan | Usulan awal |
|---|---|---|
| 1 | Siapa penandatangan tiap jenis surat? | SKK: Kepala Bagian SDM. SP dan Perjanjian Kerja: Direksi. |
| 2 | Alur persetujuan tiap jenis surat? | SKK: HR. SP: Kepala Bagian → HR → Direksi. Perjanjian Kerja: HR → Direksi. |
| 3 | Format nomor surat tiap jenis? | Mengikuti tata naskah dinas bank. Contoh: `{nomor}/SKK/SDM/{bulan_romawi}/{tahun}`. |
| 4 | Apakah SKK perlu versi bahasa Inggris? | Ya, sebagai pilihan saat pengajuan (untuk visa/luar negeri). |
| 5 | Apakah SKK boleh mencantumkan penghasilan, dan siapa yang menyetujui? | Boleh atas permintaan, dengan persetujuan tambahan Direksi. |
| 6 | Masa berlaku SP menurut Peraturan Perusahaan? | 6 bulan per SP (PP 35/2021 Pasal 52), kecuali PP Bank Gresik menetapkan lain. |
| 7 | Apakah ada teguran lisan/tertulis sebelum SP I yang perlu dicatat? | Dicatat sebagai *Teguran Tertulis* tanpa nomor SP, bila diatur PP. |
| 8 | Apakah SP berdampak ke payroll/KPI/promosi? | Tidak otomatis di versi ini; hanya penandaan. |
| 9 | Berapa lama batas waktu tanggapan pegawai atas SP? | 7 hari kalender. |
| 10 | Template pasal Perjanjian Kerja yang berlaku? | Disediakan Legal/Kepatuhan sebelum Tahap 3. |
| 11 | Pengingat akhir kontrak dikirim ke siapa saja? | HR dan Kepala Bagian pegawai yang bersangkutan, 60 dan 30 hari sebelumnya. |
| 12 | Halaman verifikasi QR boleh diakses tanpa login (oleh pihak luar seperti bank/kedutaan)? | Ya untuk SKK, hanya menampilkan nomor, jenis, tanggal, nama, dan status. SP dan Perjanjian Kerja hanya untuk yang sudah login. |

---

## 13. Acuan

- UU Nomor 13 Tahun 2003 tentang Ketenagakerjaan sebagaimana diubah UU Nomor
  6 Tahun 2023 (Cipta Kerja).
- PP Nomor 35 Tahun 2021 tentang PKWT, Alih Daya, Waktu Kerja dan Waktu
  Istirahat, serta PHK (khususnya Pasal 8 tentang jangka waktu PKWT dan
  Pasal 52 tentang surat peringatan).
- Peraturan Perusahaan / Perjanjian Kerja Bersama Perumda BPR Bank Gresik
  (perlu dikonfirmasi untuk masa berlaku SP, jenis teguran, dan pasal
  pelanggaran).
- Tata naskah dinas Perumda BPR Bank Gresik (format nomor dan penandatangan).
