# PRD — Klaim Kesehatan

| | |
|---|---|
| **Modul** | Payroll → Klaim Kesehatan |
| **Status dokumen** | Draf 4, alur disesuaikan dengan praktik: konfirmasi petugas → Nota Dinas → Approval → Disposisi Direktur |
| **Tanggal** | 17 November 2026 |
| **Penyusun** | EDP/IT Perumda BPR Bank Gresik |
| **Pemangku kepentingan** | HR / petugas klaim, pejabat penyetuju, Direktur (disposisi), Accounting (pembayaran) |

Dokumen ini menjelaskan fitur yang akan dibangun, bukan yang sudah ada. Saat ini
menu Klaim Kesehatan di HRIS baru berupa halaman rencana. Poin yang masih
menunggu keputusan dikumpulkan di bagian **9. Pertanyaan Terbuka**. Tidak ada
yang menghambat pembangunan, karena setiap poin sudah punya usulan sementara
yang bisa diubah di Pengaturan.

---

## 1. Latar Belakang

Penggantian biaya kesehatan pegawai saat ini diproses secara manual:

1. Pegawai menyerahkan nota ke petugas.
2. Petugas memeriksa nota tersebut.
3. Setelah terkumpul beberapa pegawai, petugas membuat **Nota Dinas**
   permohonan dana.
4. Nota Dinas dimintakan persetujuan pejabat terkait, lalu **disposisi
   Direktur**.
5. Dana dibayarkan.

Sisa plafon dicatat terpisah. Akibatnya:

- sisa plafon tiap pegawai sulit dipantau dan berisiko terlampaui;
- status pengajuan tidak terlihat oleh pegawai;
- Nota Dinas disusun ulang secara manual setiap kali;
- rekap per pegawai per tahun harus disusun ulang setiap kali dibutuhkan;
- nominal klaim tidak tercatat untuk perhitungan PPh 21.

## 2. Tujuan

1. Pegawai bisa mengajukan klaim beserta bukti dari HRIS dan memantau statusnya.
2. Sistem menjaga plafon tahunan secara otomatis: klaim yang melebihi sisa
   plafon hanya dibayar sebesar sisanya.
3. **Nota Dinas dibuat otomatis** dari klaim-klaim yang sudah dikonfirmasi,
   lengkap dengan tabel rincian per pegawai, total, dan terbilang.
4. Alur persetujuan Nota Dinas (Approval → Disposisi Direktur) **bisa diubah
   sewaktu-waktu** tanpa perubahan program, seperti Alur Approval Izin.
5. Setiap tahap tercatat: siapa mengonfirmasi, berapa yang disetujui, apa
   disposisinya, dan kapan dibayar.
6. Tersedia rekap per pegawai per tahun (plafon, terpakai, sisa) yang bisa
   diekspor ke Excel.
7. Nominal klaim yang dibayar otomatis masuk perhitungan PPh 21 di payroll.

**Di luar cakupan versi ini:**
- integrasi langsung dengan BPJS atau rumah sakit;
- pembayaran klaim lewat slip gaji (uangnya tetap ditransfer terpisah);
- persentase tanggungan atau iur biaya;
- klaim untuk keluarga yang tidak tercatat di data Keluarga.

## 3. Ketentuan yang Sudah Disepakati

| No | Ketentuan | Keputusan |
|---|---|---|
| A1 | Siapa yang boleh diklaimkan | Pegawai, suami/istri, dan anak yang **terdaftar di data Keluarga** HRIS |
| A2 | Pemeriksa pengajuan | Admin / petugas klaim (HR, mis. Bu Retno) |
| A3 | Hak berdasarkan status kepegawaian | **Tetap: berhak. Kontrak: berhak. Training: belum berhak** |
| B4 | Bentuk plafon | Satu plafon **per tahun**, **dipakai bersama** oleh pegawai, pasangan, dan anak |
| B5 | Besar plafon | Berdasarkan **jabatan**, mengikuti SK |
| B7 | Klaim melebihi sisa plafon | Dibayar **sebesar sisa plafon** |
| B8 | Persentase tanggungan | Tidak ada (yang disetujui dibayar 100%) |
| C11 | BPJS Kesehatan | **Wajib dipakai lebih dulu.** Yang diklaim hanya biaya yang tidak ditanggung BPJS |
| D12 | Konfirmasi klaim | Satu tahap oleh **admin / petugas klaim**, per klaim |
| D12a | Nota Dinas | Setelah terkumpul **minimal 5 klaim** terkonfirmasi (dihitung per klaim; beberapa klaim dari pegawai yang sama dihitung masing-masing), admin membuat **satu Nota Dinas** permohonan dana berisi tabel rincian pegawai |
| D12b | Approval Nota Dinas | **Approval 1** (HR / atasan / pejabat terkait) → **Disposisi Direktur**. Alurnya **fleksibel seperti Izin** dan diatur di Pengaturan Klaim Kesehatan |
| D13 | Boleh mengubah nominal | **Boleh**, karena nota sering memuat item yang tidak bisa diklaim. Wajib disertai alasan |
| E14 | Cara pembayaran | **Terpisah dari gaji.** Setelah disposisi, Accounting mencatat "Sudah Dibayar". Umumnya **tunai lewat teller**, kadang transfer |
| E14a | Rekening bank pegawai | **Ditambahkan ke data pegawai** (nama bank, nomor rekening, atas nama). Sifatnya opsional, karena pembayaran umumnya tunai |
| E15 | Batas tanggal (cut-off) | Tidak ada |
| E16 | Pajak | **Dikenai PPh 21.** Semua klaim yang dibayar dalam satu bulan digabung menjadi **satu penerimaan** di payroll bulan itu |
| F17 | Laporan | Rekap per pegawai per tahun: plafon, terpakai, sisa |

## 4. Pengguna dan Perannya

| Peran | Yang dilakukan di sistem |
|---|---|
| **Pegawai** | Mengajukan klaim untuk dirinya atau keluarganya, mengunggah bukti, melihat sisa plafon dan status, memperbaiki klaim yang diminta revisi, membatalkan klaim yang belum dikonfirmasi |
| **Admin / petugas klaim** (mis. Bu Retno) | Mengonfirmasi klaim (sesuaikan nominal, minta revisi, tolak), membuat Nota Dinas setelah terkumpul 5 klaim, menindaklanjuti Nota Dinas yang dikembalikan |
| **Pejabat penyetuju (Approval 1)** | HR, atasan pembuat Nota Dinas, atau pejabat terkait. Menyetujui atau mengembalikan Nota Dinas |
| **Direktur** | Memberi **disposisi** atas Nota Dinas |
| **Accounting** (ditunjuk di Pengaturan) | Melihat langsung di HRIS setiap Nota Dinas yang sudah didisposisi, lengkap dengan tanda tangan, disposisi, dan bukti, **tanpa perlu dicetak dan diserahkan petugas**. Mencatat pembayarannya |
| **Admin HR / Super Admin** | Mengatur petugas klaim, alur approval Nota Dinas, format Nota Dinas, jenis klaim, plafon per jabatan, status kepegawaian yang berhak, dan siapa saja Accounting-nya. Melihat rekap |

Siapa petugas, pejabat penyetuju, dan Direktur **tidak ditanam di program**.
Semuanya ditentukan di Pengaturan (bagian 5.6).

## 5. Alur Utama

```
1. Pegawai mengajukan klaim
        │
        ▼
2. Admin / petugas mengonfirmasi klaim  ──Minta revisi──▶ pegawai perbaiki ─┐
        │          └──Tolak──▶ [Ditolak]                                    │
        │ Konfirmasi (nominal boleh disesuaikan)  ◀─────────────────────────┘
        ▼
   [Terkonfirmasi — Menunggu Nota Dinas]   ← ditahan sampai terkumpul ≥ 5 klaim
        │
        ▼
3. Admin membuat NOTA DINAS (satu surat, tabel pegawai A, B, C, …)
        │
        ▼
┌─ ALUR APPROVAL NOTA DINAS (fleksibel, diatur di Pengaturan) ─┐
│ 4. Approval 1 — HR / Atasan / Pejabat terkait                │
│ 5. Disposisi Direktur                                         │
└───────────────────────────────────────────────────────────────┘
        │ disposisi "setuju"
        ▼
   [Disetujui — Menunggu Pembayaran]
        │ Accounting mencatat pembayaran
        ▼
   [Dibayar]
```

### 5.1 Pengajuan oleh pegawai

Isian formulir:

| Isian | Keterangan |
|---|---|
| Pasien | Pilihan: Diri sendiri, Suami/Istri, atau nama anak. Daftarnya diambil dari data Keluarga |
| Jenis klaim | Dari daftar jenis klaim di Pengaturan |
| Tanggal berobat | Tanggal pada nota. Untuk rawat inap: tanggal masuk dan tanggal keluar |
| Fasilitas kesehatan | Nama klinik, rumah sakit, atau apotek |
| Diagnosa / keluhan | Teks singkat (data sensitif, disimpan terenkripsi) |
| Rincian biaya | Satu baris atau lebih: uraian dan nominal. Total dihitung otomatis |
| Ditanggung BPJS | Nominal yang sudah ditanggung BPJS (boleh 0) |
| **Nominal diajukan** | Otomatis: total biaya dikurangi yang ditanggung BPJS |
| Bukti | Kuitansi/nota **wajib**, ditambah bukti lain sesuai jenis klaim (lihat 6.2). Format PDF/JPG/PNG, maks. 5 MB per file |
| Pernyataan | Centang wajib: "BPJS Kesehatan sudah digunakan lebih dulu dan data yang saya isi benar" |

Saat mengisi, pegawai melihat **plafon tahun ini, terpakai, sedang diproses,
dan sisa**. Jika nominal diajukan melebihi sisa plafon, sistem tetap menerima
pengajuan, tetapi memberi peringatan bahwa yang dapat dibayar hanya sebesar
sisa plafon.

**Validasi:**
- pegawai berstatus kepegawaian yang tidak berhak (mis. Training) tidak bisa
  membuka formulir dan diberi penjelasan;
- jika jabatan pegawai belum punya plafon di Pengaturan, pengajuan diblokir
  dengan pesan "Plafon jabatan Anda belum diatur, hubungi HR";
- jika batas waktu pengajuan diaktifkan, tanggal berobat yang sudah lewat batas
  ditolak;
- nominal diajukan harus lebih besar dari 0.

### 5.2 Konfirmasi oleh admin / petugas

Satu tahap, dikerjakan oleh salah satu **petugas klaim** yang ditunjuk di
Pengaturan.

- Petugas melihat formulir, semua bukti (dibuka dengan watermark), dan
  ringkasan plafon pegawai.
- Petugas bisa **mengubah nominal per baris rincian** atau mencoret baris yang
  tidak bisa diklaim. Setiap perubahan wajib diberi alasan, dan alasannya
  terlihat oleh pegawai.
- Sistem menghitung otomatis: **nominal terkonfirmasi = minimum(hasil
  penyesuaian, sisa plafon)**. Jika nominal terpotong plafon, muncul keterangan
  "dibatasi sisa plafon".
- Tindakan yang tersedia:
  - **Konfirmasi**: klaim masuk antrean Nota Dinas;
  - **Minta Revisi**: wajib catatan, dan klaim kembali ke pegawai untuk
    diperbaiki;
  - **Tolak**: wajib alasan.

### 5.3 Pembuatan Nota Dinas

Klaim terkonfirmasi **ditahan** di antrean **Menunggu Nota Dinas**.

- Antrean menampilkan **jumlah klaim** terkonfirmasi, misalnya "3 dari 5 klaim".
  Beberapa klaim dari pegawai yang sama dihitung masing-masing, sehingga bisa
  ikut menggenapi syarat minimal (keputusan 17 November 2026).
- Tombol **Buat Nota Dinas** baru bisa dipakai bila antrean berisi
  **minimal 5 klaim**. Angka 5 diatur di Pengaturan.
- Admin memilih klaim yang dimasukkan (bawaannya semua klaim di antrean). Sistem
  menyusun Nota Dinas otomatis, lalu admin bisa menyunting teks pembuka dan
  penutup sebelum mengajukan.
- **Pengecualian:** Super Admin dapat membuat Nota Dinas dengan kurang dari 5
  pegawai, disertai alasan tertulis (lihat Pertanyaan 9.1).
- Plafon tetap ditahan untuk klaim di antrean dan di Nota Dinas yang sedang
  diproses (lihat 6.1).

**Isi Nota Dinas** (dicetak sebagai PDF dengan kop surat):

| Bagian | Isi |
|---|---|
| Kop surat | Kop Perumda BPR Bank Gresik (dari Pengaturan) |
| Judul | NOTA DINAS |
| Nomor | Otomatis sesuai format di Pengaturan, mis. `012/ND/HR-KES/XI/2026` |
| Kepada / Dari / Tanggal / Perihal | Kepada: Direktur. Dari: pembuat atau bagian HR. Perihal: "Permohonan Dana Penggantian Biaya Kesehatan Pegawai". Semuanya bisa diatur di Pengaturan |
| Pembuka | Teks baku dari Pengaturan, bisa disunting per Nota Dinas |
| **Tabel rincian** | No, Nama Pegawai, NIP, Jabatan, Pasien (diri sendiri/pasangan/anak), Jenis Klaim, Tanggal Berobat, Nominal Disetujui |
| Total | Jumlah seluruh nominal, beserta **terbilang** |
| Penutup | Teks baku dari Pengaturan |
| Kolom tanda tangan | Pembuat Nota Dinas, lalu setiap tahap approval sesuai alur. Tanda tangan dan waktu persetujuan terisi otomatis setelah disetujui |
| Kotak Disposisi | Keputusan dan catatan disposisi Direktur, tanda tangan, dan tanggal |
| Lampiran (opsional) | Bukti kuitansi tiap klaim, digabung di belakang Nota Dinas, utuh dan berwatermark |

Nota Dinas bisa dicetak kapan saja. Sebelum disetujui, PDF-nya diberi tanda
"DRAF".

### 5.4 Approval Nota Dinas dan Disposisi Direktur

Nota Dinas melewati tahap-tahap di **Alur Approval Nota Dinas**. Bawaannya:
**Approval 1 → Disposisi Direktur**.

**Tahap Approval 1** (HR / atasan / pejabat terkait):
- Approver melihat Nota Dinas, rincian tiap klaim, dan bila perlu bukti tiap
  klaim.
- Tindakan:
  - **Setujui**: lanjut ke tahap berikutnya;
  - **Kembalikan** (wajib catatan): Nota Dinas kembali ke admin untuk
    diperbaiki, lalu diajukan ulang dari tahap pertama.
- Bila tahapnya diizinkan mengubah nominal, approver bisa **menurunkan nominal**
  klaim tertentu (dengan alasan) atau **mengeluarkan** klaim tertentu dari Nota
  Dinas. Klaim yang dikeluarkan kembali ke antrean.

**Tahap Disposisi Direktur:**
- Direktur melihat Nota Dinas lengkap beserta catatan dari tahap sebelumnya.
- Direktur memilih keputusan dan menulis catatan disposisi:

  | Keputusan disposisi | Akibat |
  |---|---|
  | **Setuju, proses pembayaran** | Nota Dinas disetujui dan diteruskan ke Accounting |
  | **Setuju dengan catatan** | Sama seperti setuju. Catatan wajib diisi dan ditampilkan ke Accounting |
  | **Tinjau ulang** | Nota Dinas kembali ke admin dengan catatan Direktur |
  | **Tidak disetujui** | Seluruh Nota Dinas ditolak. Klaim di dalamnya berstatus Ditolak dan plafonnya dilepas |

- Disposisi, nama Direktur, tanda tangan, dan tanggal tercetak di kotak
  disposisi pada PDF Nota Dinas.

Approver dan Direktur bertindak lewat **Approval Center**, satu tempat dengan
antrean Izin.

### 5.5 Accounting dan Pembayaran

Nota Dinas yang sudah didisposisi **tidak perlu dicetak dan diantar** ke
Accounting. Pegawai yang ditunjuk sebagai **Accounting** di Pengaturan (5.6)
langsung melihatnya di HRIS.

**Halaman Pembayaran Klaim (khusus Accounting)**
- Accounting membuka halaman ini dari menu pegawai. Menu ini hanya muncul bagi
  akun yang ditunjuk sebagai Accounting, sehingga tidak perlu akses menu admin
  Payroll.
- Daftar Nota Dinas dibagi menjadi tiga: **Siap Dibayar**, **Sudah Dibayar**,
  dan **Masih Proses**. Yang terakhir hanya untuk dipantau, tanpa tindakan.
- Untuk setiap Nota Dinas, Accounting bisa melihat:
  - **Nota Dinas final** dalam bentuk PDF, dengan tanda tangan setiap tahap,
    kotak disposisi Direktur, dan watermark, sama persis dengan versi cetak;
  - tabel rincian pegawai, nominal, total, dan terbilang;
  - **catatan disposisi** Direktur, ditonjolkan di bagian atas;
  - bukti kuitansi tiap klaim;
  - **rekening bank** tiap pegawai, bila sudah diisi (lihat 6.6).
- PDF Nota Dinas final diberi **kode QR verifikasi**. Jika suatu saat dicetak,
  keasliannya bisa dicek dengan memindai QR, yang membuka halaman verifikasi di
  HRIS (khusus pengguna yang login).

**Mencatat pembayaran**

Dalam praktiknya, klaim **lebih sering dibayar tunai lewat teller** daripada
ditransfer. Karena itu metode pembayaran dicatat **per pegawai**, dan bawaannya
**Tunai / Teller**.

| Metode | Yang dicatat |
|---|---|
| **Tunai / Teller** (bawaan) | Tanggal diterima. Opsional: nomor slip teller atau bukti penarikan |
| **Transfer** | Tanggal transfer, rekening tujuan (otomatis dari data pegawai, bisa diubah), referensi, dan bukti transfer (opsional) |

- Accounting bisa menandai semua pegawai di satu Nota Dinas sekaligus, misalnya
  "Semua dibayar tunai hari ini", lalu mengubah pegawai tertentu yang dibayar
  dengan transfer.
- Nota Dinas berstatus **Dibayar** setelah semua pegawai di dalamnya tercatat
  dibayar. Sebelum itu statusnya **Dibayar Sebagian**, misalnya bila ada
  pegawai yang belum mengambil uang di teller.
- Untuk pembayaran tunai tersedia **PDF Tanda Terima**: daftar pegawai,
  nominal, dan kolom tanda tangan penerima, untuk ditandatangani di teller dan
  diarsipkan. Hasil pindaiannya bisa diunggah kembali sebagai bukti.
- Status pembayaran langsung terlihat oleh petugas klaim di menu admin, jadi
  petugas tidak perlu menanyakan ke Accounting.
- Pegawai menerima notifikasi bahwa klaimnya sudah dibayar, beserta nominal
  dan metodenya.
- Daftar pembayaran per Nota Dinas bisa diekspor ke Excel: nama, NIP, nominal,
  metode, dan rekening bila ada.

### 5.6 Pengaturan

Ada di **Pengaturan Klaim Kesehatan**, terpisah dari menu Alur Approval Izin.

**Petugas klaim.** Satu atau beberapa pegawai yang boleh mengonfirmasi klaim
dan membuat Nota Dinas. Cukup salah satu yang bertindak.

**Alur Approval Nota Dinas.** Cara kerjanya sama seperti Alur Approval Izin:
tahap disusun dan diurutkan sendiri, dan bisa diubah kapan saja. Karena Nota
Dinas dibuat oleh admin, "pemohon"-nya adalah **pembuat Nota Dinas**, sehingga
jenis approver Izin tetap bisa dipakai:

| Jenis approver | Siapa |
|---|---|
| Atasan Langsung | Atasan pembuat Nota Dinas |
| Kepala Departemen | Kepala bagian pembuat Nota Dinas |
| Pegawai Tertentu | Pejabat yang ditunjuk (mis. Kabag SDM) |
| Disposisi Direktur | Direktur yang ditunjuk. Memakai tindakan disposisi di 5.4 |

Opsi setiap tahap:
- **label** yang tampil di layar dan di kolom tanda tangan Nota Dinas, mis.
  "Mengetahui, Kabag SDM";
- **boleh mengubah nominal**: ya atau tidak.

Perilaku otomatis, sama seperti Izin:
- tahap yang approver-nya adalah pembuat Nota Dinas sendiri dilewati otomatis;
- tahap yang approver-nya tidak bisa ditentukan dilewati otomatis, dan hal ini
  dicatat di riwayat;
- alur **disalin saat Nota Dinas diajukan**, sehingga perubahan alur hanya
  berlaku untuk Nota Dinas berikutnya.

Bawaan saat pertama dipakai: **Approval 1** (Pegawai Tertentu atau Atasan
Langsung, dipilih HR) → **Disposisi Direktur**.

**Format Nota Dinas.**
- Format nomor, dengan penomoran berurut per tahun yang otomatis kembali ke 1
  di awal tahun.
- Kepada, Dari, Perihal, serta teks pembuka dan penutup baku.
- Kop surat (bisa memakai kop yang sama dengan Izin).
- Lampirkan bukti kuitansi di belakang Nota Dinas: ya atau tidak.

**Accounting.** Satu atau beberapa pegawai yang ditunjuk sebagai Accounting.
Hak mereka:
- menerima notifikasi setiap ada Nota Dinas yang selesai didisposisi;
- melihat Nota Dinas final beserta bukti dan rekening pegawai (bila ada);
- mencatat pembayaran.

Jika ada beberapa Accounting, cukup salah satu yang mencatat pembayaran.
Penambahan atau penghapusan Accounting langsung berlaku dan dicatat di Log
Aktivitas. Accounting yang dihapus kehilangan akses ke halaman Pembayaran
Klaim, tetapi riwayat pembayaran yang pernah dicatatnya tetap tersimpan.

**Lainnya:**
- minimal pegawai per Nota Dinas (bawaan 5);
- jenis klaim;
- plafon per jabatan;
- status kepegawaian yang berhak;
- batas waktu pengajuan;
- aturan pergantian tahun.

### 5.7 Notifikasi

| Kejadian | Penerima |
|---|---|
| Klaim baru atau perbaikan revisi | Petugas klaim |
| Antrean mencapai 5 klaim | Petugas klaim |
| Nota Dinas masuk ke suatu tahap, termasuk disposisi | Approver atau Direktur tahap tersebut |
| Nota Dinas dikembalikan / tinjau ulang | Pembuat Nota Dinas |
| Nota Dinas selesai didisposisi "setuju" | **Semua Accounting** yang ditunjuk, dengan tautan langsung ke Nota Dinas |
| Nota Dinas dibayar | Pembuat Nota Dinas (petugas klaim) |
| Klaim diminta revisi, ditolak, terkonfirmasi, masuk Nota Dinas, disetujui, dibayar | Pegawai |
| Sisa plafon di bawah 10% | Pegawai (sekali per tahun) |

## 6. Aturan Bisnis

### 6.1 Plafon

- **Satu plafon per pegawai per tahun.** Besarnya diambil dari tabel plafon per
  jabatan di Pengaturan, sesuai SK.
- Plafon **dipakai bersama** oleh pegawai dan keluarganya. Klaim untuk pasangan
  atau anak mengurangi plafon pegawai yang sama.
- Plafon yang dipakai adalah plafon **jabatan pegawai pada tanggal berobat**
  (lihat Pertanyaan 9.4).
- Rumus:
  - **Terpakai** = jumlah nominal disetujui untuk klaim yang Nota Dinasnya
    sudah disetujui Direktur atau sudah dibayar, pada tahun tersebut.
  - **Sedang diproses** = jumlah nominal klaim yang masih berjalan: menunggu
    konfirmasi, di antrean Nota Dinas, atau di dalam Nota Dinas yang belum
    didisposisi.
  - **Sisa** = Plafon − Terpakai − Sedang diproses.
- **Penahanan plafon:** karena klaim yang sedang diproses ikut mengurangi sisa,
  dua klaim yang berjalan bersamaan tidak bisa sama-sama dibayar penuh hingga
  melebihi plafon. Klaim yang ditolak atau dibatalkan otomatis melepas
  plafonnya.
- **Tahun plafon** ditentukan dari **tanggal berobat**, bukan tanggal pengajuan.
- Pergantian tahun: plafon baru otomatis berlaku. Sisa plafon tahun lalu
  **hangus** (bawaan, menunggu konfirmasi 9.2).
- HR bisa memberi **penyesuaian plafon per pegawai** (tambah atau kurang)
  dengan alasan, untuk kasus khusus sesuai keputusan Direksi.

### 6.2 Jenis klaim

Daftar jenis klaim diatur di Pengaturan (tambah, ubah, nonaktifkan). Usulan
awal, menunggu konfirmasi HR:

| Jenis | Bukti wajib selain kuitansi |
|---|---|
| Rawat Jalan | — |
| Rawat Inap | Surat rujukan / resume medis |
| Obat / Apotek | Resep dokter |
| Kacamata | Resep dokter mata |
| Perawatan Gigi | — |
| Persalinan | Surat keterangan lahir |
| Lainnya | Surat keterangan dokter |

Untuk setiap jenis bisa diatur **bukti yang wajib**. Bisa juga diatur **batas
per klaim** atau **batas frekuensi** (mis. kacamata 1 kali per 2 tahun), tetapi
batas ini baru dipakai jika SK mengaturnya.

### 6.3 Hak berdasarkan status kepegawaian

Di Pengaturan, HR mencentang status kepegawaian yang berhak klaim. Pada awalnya
Tetap dan Kontrak berhak, sedangkan Training tidak. Status baru yang
ditambahkan di master data otomatis **tidak berhak** sampai dicentang.

Pegawai nonaktif tidak bisa mengajukan klaim baru. Klaim yang sudah diajukan
sebelum pegawai nonaktif tetap diproses sampai selesai.

### 6.4 BPJS

- Setiap pengajuan mencatat total biaya, bagian yang ditanggung BPJS, dan
  selisih yang diklaim.
- Pegawai wajib mencentang pernyataan bahwa BPJS sudah digunakan.
- Pengecualian (mis. faskes tidak bekerja sama dengan BPJS, atau kondisi
  darurat) diputuskan petugas saat konfirmasi dan wajib diberi catatan.

### 6.5 PPh 21

Klaim kesehatan dikenai PPh 21 walaupun uangnya dibayar di luar gaji.
Penanganan yang disepakati:

- Semua klaim seorang pegawai yang **dibayar pada bulan M** dijumlahkan menjadi
  **satu penerimaan "Reimbursement Kesehatan"** di **proses payroll bulan M**.
- Penerimaan ini **menambah dasar PPh 21** tetapi **tidak dibayarkan lagi** di
  slip gaji, karena uangnya sudah dibayarkan terpisah (tunai atau transfer). Di
  slip, penerimaan ini tampil sebagai informasi.
- Jika pembayaran dicatat setelah payroll bulan M dikunci, nominalnya masuk ke
  payroll bulan berikutnya yang masih terbuka.
- Untuk pembayaran yang tercatat **Dibayar Sebagian**, yang masuk payroll
  hanya bagian pegawai yang sudah dibayar, di bulan tanggal bayarnya masing-masing.

### 6.6 Rekening bank pegawai

Data pegawai saat ini belum memiliki rekening bank. Fitur ini menambahkan
kolom berikut ke **Data Pegawai**, di tab Data Payroll:

| Kolom | Keterangan |
|---|---|
| Nama bank | Mis. Bank Gresik, BRI, BCA |
| Nomor rekening | Hanya angka |
| Atas nama | Bawaannya nama pegawai, bisa diubah |

- Semua kolom **opsional**, karena pembayaran klaim umumnya tunai lewat teller.
  Klaim tetap bisa diproses walaupun rekening kosong.
- Rekening hanya **wajib** saat Accounting memilih metode **Transfer** untuk
  pegawai tersebut. Bila kosong, Accounting bisa mengisinya langsung di
  formulir pembayaran dan memilih untuk menyimpannya ke data pegawai.
- Bisa diisi oleh HR, atau diisi sekaligus lewat **Import Pegawai** (kolom
  baru di template).
- Pegawai bisa melihat rekeningnya sendiri di Profil Saya. Perubahannya tetap
  dilakukan HR, supaya rekening tidak bisa dialihkan diam-diam.
- Rekening bank tidak dibatasi untuk klaim kesehatan, sehingga nanti bisa
  dipakai juga di modul lain seperti Payroll.

## 7. Menu dan Halaman

### Pegawai
- **Klaim Kesehatan** berisi:
  - kartu plafon tahun ini (plafon, terpakai, sedang diproses, sisa);
  - daftar klaim beserta status dan filter tahun;
  - tombol **Ajukan Klaim**;
  - detail klaim dengan riwayat konfirmasi, alasan perubahan nominal, nomor
    Nota Dinas, dan status pembayaran.

### Approval Center
Pejabat penyetuju dan Direktur melihat Nota Dinas yang menunggu tindakannya
bersama antrean Izin.

### Pembayaran Klaim (khusus Accounting)
Menu di portal pegawai yang hanya muncul bagi akun yang ditunjuk sebagai
Accounting. Isinya:
- tab Siap Dibayar, Sudah Dibayar, dan Masih Proses;
- tampilan Nota Dinas final, bukti, dan rekening (bila ada);
- formulir pencatatan pembayaran per pegawai (tunai/teller atau transfer);
- PDF Tanda Terima untuk pembayaran tunai;
- ekspor Excel daftar transfer.

Lihat 5.5.

### Admin (Payroll → Klaim Kesehatan)

| Tab / halaman | Isi | Untuk |
|---|---|---|
| **Konfirmasi** | Klaim yang menunggu konfirmasi petugas | Petugas klaim |
| **Antrean Nota Dinas** | Klaim terkonfirmasi dengan progres "x dari 5 klaim". Tombol Buat Nota Dinas | Petugas klaim |
| **Nota Dinas** | Daftar Nota Dinas beserta posisi tahap, disposisi, dan cetak PDF | Petugas klaim, Accounting |
| **Pembayaran** | Status pembayaran tiap Nota Dinas, hanya untuk dipantau. Pencatatannya dilakukan Accounting di menu Pembayaran Klaim | Petugas klaim |
| **Semua Klaim** | Pencarian dan filter (pegawai, jenis, status, periode) | Petugas klaim, Accounting |
| **Rekap Plafon** | Per pegawai per tahun: jabatan, plafon, terpakai, diproses, sisa, jumlah klaim. Ekspor Excel | HR, Accounting, Direksi |
| **Pengaturan** | Petugas klaim, Alur Approval Nota Dinas, format Nota Dinas, **Accounting**, jenis klaim, plafon per jabatan, status berhak, minimal pegawai, batas waktu, pergantian tahun | Admin HR / Super Admin |

Hak akses mengikuti Manajemen Akses HR. Menu **Klaim Kesehatan** sudah
terdaftar, dan akan ditambah satu akses terpisah untuk **Pengaturan Klaim
Kesehatan**. Pejabat penyetuju, Direktur, dan Accounting **tidak perlu**
akses menu admin. Pejabat penyetuju dan Direktur bertindak lewat Approval
Center, sedangkan Accounting lewat menu Pembayaran Klaim.

### Laporan Excel "Rekap Plafon"

| NIP | Nama | Jabatan | Status | Plafon | Penyesuaian | Terpakai | Diproses | Sisa | Jml Klaim |
|---|---|---|---|---|---|---|---|---|---|

Sheet kedua berisi rincian semua klaim tahun tersebut: tanggal berobat, pasien,
jenis, nominal diajukan, nominal disetujui, nomor Nota Dinas, disposisi, dan
tanggal bayar.

## 8. Keamanan dan Jejak Audit

- Bukti klaim dan diagnosa adalah **data kesehatan**, yang termasuk data pribadi
  sensitif. Perlakuannya:
  - bukti disimpan di luar folder publik dan diberi watermark saat dibuka;
  - bukti hanya bisa dibuka oleh pemilik klaim, petugas klaim, approver Nota
    Dinas terkait, Direktur, Accounting yang ditunjuk, dan Super Admin;
  - rekening bank pegawai hanya tampil bagi pegawai yang bersangkutan, HR, Accounting, dan petugas klaim;
  - diagnosa disimpan terenkripsi dan **tidak dicetak di Nota Dinas**.
- Setiap tindakan (ajukan, konfirmasi, ubah nominal, revisi, tolak, buat Nota
  Dinas, setujui, kembalikan, disposisi, bayar) dicatat beserta pelaku, waktu,
  nominal sebelum dan sesudah, dan alasan atau catatan. Riwayat ini tampil di
  detail klaim atau Nota Dinas dan di Log Aktivitas.
- Perubahan pengaturan alur dan format Nota Dinas juga dicatat di Log
  Aktivitas.
- Nota Dinas yang sudah disetujui dan klaim yang sudah **Dibayar** tidak bisa
  diubah atau dihapus. Koreksi dilakukan dengan **pembatalan** oleh Super Admin,
  disertai alasan.
- Data klaim ikut dalam backup modul Payroll. File bukti ikut dalam Monitoring
  Penyimpanan dan scan malware.

## 9. Pertanyaan Terbuka

Tidak ada yang menghambat pembangunan. Usulan sementara dipakai sebagai nilai
bawaan dan bisa diubah di Pengaturan.

| No | Pertanyaan | Usulan sementara | Ditanyakan ke |
|---|---|---|---|
| 9.1 | Jika sampai **akhir tahun** antrean belum mencapai 5 klaim, apakah klaimnya tetap diproses? | Super Admin boleh membuat Nota Dinas dengan kurang dari 5 klaim, disertai alasan | HR |
| 9.2 | Plafon per **tahun kalender (Jan–Des)**, dan sisa **hangus** di akhir tahun? | Ya, keduanya | HR |
| 9.3 | Batas waktu pengajuan setelah tanggal berobat? | 30 hari, bisa dimatikan di Pengaturan | HR |
| 9.4 | Pegawai mutasi atau naik jabatan di tengah tahun: plafon mengikuti jabatan baru secara penuh, atau dihitung proporsional? | Mengikuti jabatan **pada tanggal berobat**, terpakai tetap diakumulasi | HR |
| 9.5 | Daftar final jenis klaim dan bukti wajib tiap jenis | Tabel 6.2 | HR |
| 9.6 | Pegawai baru berstatus Kontrak di tengah tahun: plafon penuh atau proporsional sejak mulai kerja? | Penuh | HR |
| 9.7 | Apakah ada batas usia atau jumlah anak yang boleh diklaimkan? | Sesuai data Keluarga, tanpa batas | HR |
| 9.8 | Pegawai Training yang menjadi Kontrak: apakah biaya berobat **sebelum** perubahan status bisa diklaim? | Tidak, yang dihitung status pada tanggal berobat | HR |
| 9.9 | **Contoh Nota Dinas** yang dipakai sekarang (format nomor, Kepada/Dari, teks pembuka dan penutup, kolom tanda tangan) | Format umum di 5.3. Mohon dikirim contoh asli agar PDF-nya disamakan | HR |
| 9.10 | Approval 1 umumnya siapa: Kabag SDM, atasan pembuat Nota Dinas, atau pejabat lain? | Pegawai Tertentu yang ditunjuk HR | HR |
| 9.11 | Apakah Direktur boleh **mengubah nominal**, atau cukup memberi keputusan disposisi? | Tidak mengubah nominal. Cukup keputusan disposisi dan catatan | Direksi |
| 9.12 | Nominal plafon per jabatan dari lampiran SK | Dibutuhkan saat pengisian data, bukan untuk pembangunan | HR |
## 10. Kriteria Selesai

Fitur dianggap selesai bila:

1. Pegawai Tetap dan Kontrak bisa mengajukan klaim untuk dirinya dan keluarga
   terdaftar. Pegawai Training tidak bisa.
2. Sisa plafon tampil benar sebelum dan sesudah klaim disetujui, termasuk klaim
   yang sedang diproses, dan dipakai bersama sekeluarga.
3. Klaim yang melebihi sisa plafon otomatis dibatasi sebesar sisa plafon, dan
   keterangannya terlihat.
4. Petugas bisa mengonfirmasi, menyesuaikan nominal dengan alasan, meminta
   revisi, atau menolak klaim.
5. Nota Dinas baru bisa dibuat setelah ada klaim terkonfirmasi dari minimal 5
   pegawai, dan PDF-nya berisi tabel rincian pegawai, total, terbilang, kolom
   tanda tangan, dan kotak disposisi.
6. Alur Approval Nota Dinas bisa disusun dan diubah dari Pengaturan tanpa
   perubahan program. Nota Dinas yang sedang berjalan tidak terpengaruh.
7. Direktur bisa memberi disposisi (setuju, setuju dengan catatan, tinjau
   ulang, tidak disetujui), dan disposisinya tercetak di Nota Dinas.
8. Accounting yang ditunjuk di Pengaturan menerima notifikasi dan bisa melihat
   Nota Dinas final (tanda tangan, disposisi, bukti, rekening bila ada) langsung di
   HRIS tanpa cetakan dari petugas, lalu mencatat pembayaran per Nota Dinas.
   Pegawai dan petugas klaim menerima notifikasi pembayaran.
9. Rekap Plafon per pegawai per tahun bisa diekspor ke Excel dengan angka yang
   cocok dengan tampilan layar.
10. Semua klaim yang dibayar dalam satu bulan masuk sebagai satu penerimaan
    "Reimbursement Kesehatan" di payroll bulan itu dan ikut dihitung PPh 21,
    tanpa dibayarkan dua kali.
11. Bukti klaim hanya bisa dibuka oleh pihak yang berhak, dan setiap akses
    tercatat.

## 11. Tahapan Pengerjaan (usulan)

| Tahap | Isi |
|---|---|
| 1 | Pengaturan dasar (petugas klaim, jenis klaim, plafon per jabatan, status berhak). Kolom rekening bank di data pegawai dan Import Pegawai. Pengajuan pegawai dan kartu plafon |
| 2 | Konfirmasi petugas (penyesuaian nominal, revisi, tolak) dan notifikasi |
| 3 | Antrean dan pembuatan Nota Dinas, PDF Nota Dinas, Alur Approval Nota Dinas dengan Disposisi Direktur, integrasi Approval Center |
| 4 | Pengaturan Accounting, menu Pembayaran Klaim (Nota Dinas final dengan QR verifikasi, pencatatan pembayaran), Rekap Plafon dan ekspor Excel |
| 5 | Penerimaan "Reimbursement Kesehatan" di Proses Payroll dan perhitungan PPh 21 |

Semua tahap bisa dimulai sekarang. Contoh Nota Dinas asli (9.9) sebaiknya
sudah ada sebelum tahap 3 supaya PDF-nya langsung sesuai format kantor.
