# Fitur Kepegawaian

Dokumentasi modul Kepegawaian pada HRIS Perumda BPR Bank Gresik. Ditulis dari
kode yang berjalan — kalau ada perbedaan dengan praktik di lapangan, kodenya
yang jadi acuan.

Modul ini memuat data induk: pegawai beserta seluruh berkasnya, struktur
organisasi, dan data master yang dipakai modul lain (Absensi, Izin, Payroll).

---

## Menu

| Menu | Alamat | Isi |
|---|---|---|
| Data Pegawai | `/admin/pegawai` | Daftar & detail seluruh pegawai |
| Struktur Organisasi | `/admin/struktur-organisasi` | Bagan atasan–bawahan |
| Data Jabatan | `/admin/jabatan` | Master jabatan + tarif tunjangan kehadiran |
| Data Bagian | `/admin/bagian` | Master departemen + kepala bagian |
| Data Lokasi Kerja | `/admin/lokasi-kerja` | Master kantor + titik geofence |
| Data Hari & Jam Kerja | `/admin/jam-kerja` | Shift, hari kerja, penyesuaian |
| Hari Libur Nasional | `/admin/hari-libur` | Kalender libur & cuti bersama |
| Saldo Cuti Pegawai | `/admin/saldo-cuti` | Kuota & penyesuaian cuti tahunan |
| Pengaturan Kepegawaian | `/admin/pegawai/pengaturan` | Watermark dokumen pribadi |

Akses tiap sub-menu bisa dibuka/ditutup per akun HR Admin lewat **Manajemen
Akses HR**. SUPER_ADMIN selalu punya akses penuh.

---

## Data Pegawai

### Struktur Data

Data satu pegawai dibagi ke enam tab di halaman detail:

| Tab | Isi |
|---|---|
| **Data Umum** | NIP, nama, tanggal masuk, jabatan, bagian, lokasi kerja, atasan, jam kerja, status kepegawaian, golongan |
| **Data Pribadi** | NIK, tempat & tanggal lahir, jenis kelamin, alamat, kontak, pendidikan, hobi, media sosial |
| **Keluarga** | Pasangan, anak (beserta akta kelahiran), nama orang tua |
| **Data Payroll** | Komponen gaji, NPWP, status PTKP, rekening |
| **Dokumen** | Scan KTP, Kartu Keluarga, NPWP, Surat Nikah/Akta Cerai |
| **Pengecualian Cuti** | Saklar pengecualian Cuti Besar |

Selain itu tersimpan **riwayat** pegawai dalam tabel terpisah: riwayat
pekerjaan, pelatihan, prestasi, penghargaan & sanksi, mutasi, dan surat tugas.

### Identitas di URL

Halaman pegawai memakai **`publicId`** (string acak), bukan nomor urut
database. Ini disengaja supaya orang tidak bisa menebak-nebak URL pegawai lain
dengan mengubah angka.

### Data Sensitif Terenkripsi

**NIK** dan **riwayat penyakit** disimpan dalam keadaan terenkripsi
(AES-256-GCM) di database, dan otomatis didekripsi saat dibaca. Kuncinya ada
di `EMPLOYEE_DATA_ENCRYPTION_KEY`.

> **Penting:** kunci ini **tidak boleh diganti** setelah ada data tersimpan —
> data lama tidak akan bisa dibaca lagi. Simpan cadangannya terpisah dari
> server.

### Dokumen Pribadi

Scan KTP, KK, NPWP, dan Surat Nikah/Akta Cerai (serta Akta Kelahiran anak)
diperlakukan berbeda dari foto biasa:

- Disimpan di `storage/dokumen-pegawai/`, **di luar folder publik** — tidak
  bisa diakses lewat URL langsung.
- Hanya bisa dibuka lewat rute yang memeriksa login: **SUPER_ADMIN, HR_ADMIN,
  atau pegawai yang bersangkutan sendiri**.
- Format PDF/JPG/PNG, maksimal 5MB.
- Setiap pembukaan tercatat di Log Aktivitas.
- **Diberi watermark otomatis saat dibuka** (lihat bagian Pengaturan di bawah).

### Menambah & Mengubah

- **Tambah satu per satu** — form `/admin/pegawai/baru`. Saat membuat baru,
  hanya kolom wajib yang ditampilkan; sisanya dilengkapi belakangan lewat
  halaman detail.
- **Impor massal** — unduh template Excel, isi, lalu unggah. Baris yang tidak
  valid **dilewati beserta keterangan kesalahannya**, sisanya tetap diproses;
  hasilnya dilaporkan sebagai jumlah berhasil, jumlah gagal, dan daftar
  masalah per baris.
- **Cetak CV** — data pegawai bisa dicetak jadi PDF berformat CV.

> **Membuat pegawai sekaligus membuatkan akun login.** Username-nya memakai
> NIP, dan password acak dibuatkan sistem. Untuk impor massal, daftar
> username & password hasil impor ditampilkan sekali di layar dan bisa
> diunduh sebagai CSV — **setelah ditutup, password itu tidak bisa dilihat
> lagi**; satu-satunya jalan adalah mereset password akun tersebut satu per
> satu. Pastikan daftarnya disimpan atau dibagikan lebih dulu.

### Menghapus Pegawai

Penghapusan bersifat **soft delete** — datanya tidak benar-benar hilang:

- Wajib mengisi **alasan penghapusan**; sistem mencatat siapa dan kapan.
- Pegawai terhapus pindah ke halaman **Pegawai Terhapus**
  (`/admin/pegawai/terhapus`) dan bisa dipulihkan.
- Riwayat absensi, izin, dan payroll-nya tetap utuh — penting supaya laporan
  periode lama tidak berubah.

### Pengecualian Cuti Besar

Normalnya Cuti Besar hanya boleh diambil 2 kali. Lewat tab **Pengecualian
Cuti**, admin bisa membuka satu kesempatan tambahan untuk pegawai tertentu
(`allowCutiBesarException`). Dipakai untuk kasus khusus yang diputuskan
manajemen.

---

## Struktur Organisasi

Dibentuk dari kolom **atasan langsung** tiap pegawai, jadi tidak perlu disusun
terpisah — mengubah atasan di data pegawai langsung mengubah bagannya.

Struktur ini bukan sekadar tampilan: **alur approval izin memakainya**. Tipe
approver "Atasan Langsung" diambil dari sini, dan "Kepala Departemen" diambil
dari kepala bagian yang diatur di Data Bagian.

---

## Data Master

### Data Jabatan

Selain nama jabatan, tiap jabatan bisa diberi **tarif tunjangan kehadiran per
hari**. Nilai ini dikalikan jumlah hari hadir saat Proses Payroll. Dikosongkan
berarti jabatan tersebut tidak mendapat tunjangan kehadiran.

### Data Bagian

Nama, kode, dan **kepala bagian**. Kepala bagian inilah yang dipakai sebagai
approver bertipe "Kepala Departemen" di alur izin.

### Data Lokasi Kerja

Nama dan alamat kantor, plus **titik koordinat & radius geofence** (bawaan 100
meter). Radius ini dipakai untuk menilai apakah pegawai berada di lokasi saat
mengajukan izin yang merekam posisi, misalnya Izin Lembur.

### Data Hari & Jam Kerja

Mengatur shift kerja:

- **Jam masuk & jam pulang** — dipakai menentukan status Terlambat dan Pulang
  Cepat pada data absensi.
- **Hari kerja** — bawaan Senin–Jumat. Dipakai payroll untuk mendeteksi
  mangkir (hari kerja tanpa absensi dan tanpa izin).
- **Tipe shift** — Pegawai atau Outsourcing.
- **Penyesuaian jam kerja** — jam berbeda untuk periode tertentu, misalnya
  bulan Ramadan.

### Hari Libur Nasional

Kalender libur nasional dan cuti bersama. Bisa diisi manual atau diimpor dari
Excel.

Tiap tanggal punya penanda **"kantor tetap masuk"**. Kalau dinyalakan, tanggal
itu tetap dihitung sebagai hari kerja — berguna untuk libur nasional yang
kantornya tetap beroperasi.

Kalender ini dipakai Izin Cuti dan Dispensasi supaya hari libur tidak ikut
memotong jatah cuti.

### Saldo Cuti Pegawai

Mengatur kuota cuti tahunan per pegawai per tahun:

- **Kuota** bawaan 12 hari.
- **Penyesuaian** — tambahan atau pengurangan dengan catatan alasan.
- Sisa tahun sebelumnya terbawa maksimal 6 hari dan hangus setelah 31 Maret.

Rincian aturannya ada di [dokumentasi Izin](./fitur-izin.md#izin-cuti-cuti-tahunan).

---

## Pengaturan Kepegawaian

Di `/admin/pegawai/pengaturan`.

### Watermark Dokumen Pribadi

Scan KTP, KK, NPWP, dan Surat Nikah/Akta Cerai diberi watermark otomatis
**setiap kali dibuka** — bukan dicap permanen saat diunggah. Berkas aslinya
tetap tersimpan utuh, karena dokumen ini masih sering dibutuhkan apa adanya
untuk urusan BPJS atau bank.

Isi watermark:

- Pola tulisan **RAHASIA** menutupi seluruh halaman
- **Nama dan NIP pemilik** dokumen
- **Nama pembuka dan waktunya** — inilah yang membuat tangkapan layar yang
  beredar bisa dilacak ke orangnya
- Logo sistem
- Baris teks tambahan yang bisa diatur sendiri

Bisa dimatikan kalau dirasa mengganggu keterbacaan.

> **Belum berlaku untuk Akta Kelahiran anak.** Berkas itu disimpan di folder
> terlindungi yang sama, tapi disajikan lewat rute berbeda yang belum
> memakai watermark.

---

## Kaitan dengan Modul Lain

| Data | Dipakai untuk |
|---|---|
| Atasan langsung & kepala bagian | Menentukan approver di alur izin |
| Jam kerja & hari kerja | Status Terlambat/Pulang Cepat, deteksi mangkir |
| Hari libur nasional | Perhitungan hari kerja Izin Cuti & Dispensasi |
| Tarif tunjangan per jabatan | Perhitungan Tunjangan Kehadiran di payroll |
| Geofence lokasi kerja | Penilaian posisi saat mengajukan izin |
| PIN mesin absensi | Menghubungkan tap fingerprint ke pegawai |
| Status PTKP & NPWP | Perhitungan PPh 21 |

### PIN Mesin Absensi

Kolom **PIN** di data pegawai dipetakan **manual** oleh admin — tidak ada
hubungan otomatis dengan NIP. Selama PIN belum diisi, tap fingerprint pegawai
itu masuk sebagai data absensi tanpa pemilik dan tidak muncul di riwayat
absensinya.

---

## Batasan yang Diketahui

1. **Akta Kelahiran anak belum ber-watermark** — lihat catatan di atas.
2. **Foto pegawai, tanda tangan, dan paraf disimpan di folder publik** —
   berbeda dari dokumen identitas, berkas ini bisa diakses lewat URL langsung
   tanpa login. Untuk melindunginya perlu pemindahan ke penyimpanan
   terlindungi lebih dulu.
3. **Kunci enkripsi tidak bisa dirotasi** — mengganti
   `EMPLOYEE_DATA_ENCRYPTION_KEY` membuat NIK dan riwayat penyakit yang sudah
   tersimpan tidak terbaca.

---

## Referensi Kode

| Bagian | Berkas |
|---|---|
| Model data pegawai | `prisma/schema.prisma` (model `Employee`) |
| Enkripsi NIK & riwayat penyakit | `lib/prisma.ts`, `lib/encryption.ts` |
| Penyimpanan dokumen pribadi | `lib/employee-document-storage.ts` |
| Watermark dokumen | `lib/employee-document-watermark.ts` |
| Rute unduh dokumen | `app/api/pegawai/[publicId]/dokumen/[type]/route.ts` |
| Aksi data pegawai | `server/actions/employees.ts` |
| Impor pegawai dari Excel | `lib/reports/employee-import-template.ts` |
| Saldo & carry-over cuti | `lib/leave-balance.ts` |
| Perhitungan hari kerja | `lib/working-days.ts` |
| Hak akses per sub-menu | `lib/hr-menu-access.ts` |
