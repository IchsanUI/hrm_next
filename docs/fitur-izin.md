# Fitur Izin & Cuti

Dokumentasi modul Izin pada HRIS Perumda BPR Bank Gresik. Ditulis dari kode
yang berjalan, bukan dari rencana — kalau ada perbedaan dengan praktik di
lapangan, kodenya yang jadi acuan.

Semua jenis izin di bawah ini **sudah aktif** dan bisa diajukan pegawai lewat
menu **Ajukan Izin** (`/pegawai/ajukan-izin`).

---

## Daftar Jenis Izin

Ada 13 jenis, didefinisikan di `lib/leave-types.ts`.

| Jenis | Ringkasan | Form |
|---|---|---|
| Izin Lembur | Kerja di luar jam kerja | `/pegawai/ajukan-izin/lembur` |
| Izin Meninggalkan Kantor | Keluar sementara saat jam kerja (pribadi/dinas) | `.../meninggalkan-kantor` |
| Izin Cuti | Cuti tahunan | `.../cuti` |
| Izin Sakit | Tidak masuk karena sakit | `.../sakit` |
| Izin Pulang Cepat | Pulang sebelum jam kerja berakhir | `.../pulang-cepat` |
| Izin Terlambat | Dilaporkan saat terlambat masuk | `.../terlambat` |
| Cuti Bersalin / Gugur Kandungan | Melahirkan atau gugur kandungan | `.../cuti-bersalin` |
| Cuti Besar | 2 bulan untuk masa kerja panjang | `.../cuti-besar` |
| Cuti Di Luar Tanggungan | Maks. 3 bulan tanpa gaji | `.../cuti-diluar-tanggungan` |
| Cuti Khusus (Haji/Umroh) | Ibadah, gaji penuh | `.../cuti-khusus` |
| Dispensasi | Kejadian khusus, gaji penuh | `.../dispensasi` |
| Izin Absen Diluar Kantor | Dinas sehingga tak bisa absen fingerprint | `.../absen-luar-kantor` |
| Izin Tidak Absen Datang/Pulang | Pernyataan resmi kalau lupa presensi | `.../tidak-absen` |

---

## Aturan per Jenis

### Izin Cuti (Cuti Tahunan)

- **Kuota** 12 hari per tahun (`EmployeeLeaveBalance.quota`), bisa disesuaikan
  per pegawai lewat kolom `adjustment` di menu Saldo Cuti Pegawai.
- **Sisa cuti tahun lalu** ikut terbawa maksimal **6 hari**, dan hanya berlaku
  sampai **31 Maret** tahun berjalan. Lewat tanggal itu sisa bawaan hangus.
- **Sabtu, Minggu, dan hari libur nasional tidak dihitung** sebagai pemakaian
  cuti.
- Pengajuan **lebih dari 3 hari** wajib melampirkan dokumen pendukung, dan
  ikut melewati step **Pegawai Tertentu** (checkpoint HR) di alur approval.
  Pengajuan **3 hari atau kurang** tidak butuh dokumen dan step itu otomatis
  dilewati, walau approver-nya sudah diatur di Alur Approval.
- Tanggal mulai tidak boleh di hari yang sudah lewat.
- **Pegawai yang mengambil Cuti Besar di tahun tertentu kehilangan hak Cuti
  Tahunan di tahun itu** (Pasal 38 ayat 3). Sisa cutinya otomatis jadi 0.

### Cuti Besar

- Durasi **1 bulan per pengajuan**, maksimal **2 kali pengajuan** (total 2 bulan).
- Syarat masa kerja: pengajuan ke-1 minimal **6 tahun**, pengajuan ke-2 minimal
  **7 tahun**.
- Sistem menandai pengajuan sebagai **terlambat** kalau masa kerja sudah
  melewati 7 tahun (untuk pengajuan ke-1) atau 8 tahun (ke-2).
- Tanggal selesai dihitung otomatis: 1 bulan sejak tanggal mulai, dikurangi
  satu hari.

### Cuti Di Luar Tanggungan Perusahaan

- Syarat masa kerja minimal **10 tahun**.
- Maksimal **3 bulan**.
- Harus diajukan minimal **1 bulan sebelum** tanggal mulai.
- Tanpa gaji.

### Cuti Khusus (Haji / Umroh)

- **Haji maksimal 40 hari**, **Umroh maksimal 20 hari**.
- Gaji penuh.
- Hak **1 kali seumur masa kerja** untuk tiap jenis.

### Cuti Bersalin / Gugur Kandungan

Durasi dihitung otomatis dari satu tanggal acuan (HPL atau tanggal kejadian),
memakai patokan **45 hari** per sisi:

- **Cuti Bersalin** — 45 hari **sebelum** dan 45 hari **sesudah** tanggal HPL
  (total ±90 hari).
- **Gugur Kandungan** — 45 hari **sejak** tanggal kejadian.

Surat keterangan dokter wajib dilampirkan.

### Dispensasi

Gaji penuh dan **tidak memotong saldo Cuti Tahunan**. Sabtu, Minggu, dan hari
libur nasional tidak dihitung serta tidak bisa jadi tanggal mulai.

Sebagian kategori punya durasi tetap, sebagian dinilai approver:

| Kategori | Durasi |
|---|---|
| Pegawai melaksanakan pernikahan | 3 hari |
| Suami/istri, anak kandung/angkat meninggal | 2 hari |
| Orang tua/mertua meninggal | 2 hari |
| Menikahkan anak kandung/angkat | 2 hari |
| Istri melahirkan atau keguguran | 2 hari |
| Mengkhitankan anak | 2 hari |
| Anggota keluarga serumah meninggal | 1 hari |
| Pegawai pindah rumah | 1 hari |
| Melayat keluarga/tetangga/rekan | waktu wajar |
| Panggilan resmi instansi pemerintah | waktu wajar |
| Mengurus SIM | waktu wajar |
| Ujian perguruan tinggi | waktu wajar |

### Izin Sakit

Wajib melampirkan Surat Keterangan Sakit/Dokter. Dokumennya **boleh menyusul**
— pengajuan tetap bisa diproses approver tanpa menunggu lampiran.

### Izin Lembur

Diajukan sebagai rencana, lalu dilengkapi laporan detail setelah selesai.
Lokasi saat mengajukan direkam. Pengajuan yang **tidak diproses Atasan
Langsung/Kepala Departemen dalam 24 jam otomatis ditolak sistem** (lihat
bagian Auto-Reject di bawah).

### Izin Terlambat, Pulang Cepat, Meninggalkan Kantor

Izin harian yang diajukan pada hari itu juga. Batas jam pengajuannya diatur
per jenis di **Pengaturan Izin** (lihat di bawah).

### Izin Absen Diluar Kantor & Izin Tidak Absen

Dipakai saat pegawai tidak bisa/lupa melakukan presensi fingerprint. Izin
Tidak Absen berbentuk pernyataan resmi yang ditandatangani atasan dan Direksi.

---

## Alur Approval

Diatur per jenis izin di menu **Alur Approval** (`/admin/alur-approval`) —
urutannya bisa diubah tanpa menyentuh kode.

**Tipe approver yang berfungsi:**

- **Atasan Langsung** — diambil dari atasan pemohon
- **Kepala Departemen** — kepala bagian pemohon
- **Direksi** — pegawai tertentu yang ditunjuk
- **Pegawai Tertentu** — pegawai bebas yang ditunjuk (dipakai juga sebagai
  checkpoint HR)
- **Pegawai Pengganti** — bukan approval, melainkan konfirmasi kesediaan

**Perilaku otomatis:**

- Step yang pejabatnya **adalah pemohon sendiri** otomatis dilewati, supaya
  tidak menyetujui pengajuannya sendiri.
- Step yang approver-nya **tidak bisa ditentukan** juga dilewati otomatis.
- Kalau satu step menolak, step-step sesudahnya dibatalkan.

**Catatan:** tipe **HR** belum diimplementasi di runtime — kalau dipasang di
alur, step-nya akan selalu dilewati. Gunakan **Pegawai Tertentu** sebagai
gantinya.

### Pegawai Pengganti

Tersedia di Cuti, Sakit, Dispensasi, Cuti Bersalin, Cuti Besar, Cuti Khusus,
dan Cuti Di Luar Tanggungan. Kalau pemohon memilih pengganti, orang itu
dikirimi konfirmasi **Bersedia / Tidak Bersedia**. Kalau menolak, status
pengajuan jadi **Revisi** dan pemohon diminta memilih pengganti baru.

Kalau pemohon tidak memilih pengganti, step-nya dilewati.

> **Belum berlaku di Izin Lembur.** Kalau step Pegawai Pengganti dipasang di
> alur Izin Lembur, step itu akan selalu dilewati karena
> `server/actions/overtime.ts` belum mendukungnya.

### Status Pengajuan

| Status | Arti |
|---|---|
| Menunggu Approval | Sedang di salah satu step approval |
| Disetujui | Seluruh step lolos |
| Ditolak | Ditolak di salah satu step |
| Revisi | Pegawai pengganti menyatakan tidak bersedia |

### Auto-Reject Izin Lembur 24 Jam

Izin Lembur yang **step approval pertamanya** (Atasan Langsung/Kepala
Departemen) tidak diproses dalam **24 jam sejak diajukan** otomatis ditolak
sistem.

- Hanya step pertama yang punya batas waktu. Begitu atasan menyetujui,
  pengajuan aman berapa lama pun step berikutnya diproses.
- Dihitung 24 jam berjalan sejak waktu pengajuan — bukan hari kalender, jadi
  akhir pekan ikut terhitung.
- Bisa dimatikan SUPER_ADMIN lewat **Pengaturan Izin**.
- Berjalan lewat cron eksternal yang memanggil
  `/api/cron/reject-expired-overtime`; kalau cron-nya tidak dijadwalkan di
  server, fitur ini tidak jalan.

---

## Pengaturan Izin

Di `/admin/izin/pengaturan` (SUPER_ADMIN, atau HR_ADMIN yang diberi akses
`approval.pengaturan`).

**Per jenis izin:**

| Pengaturan | Fungsi |
|---|---|
| Aktif/Nonaktif | Menutup jenis izin agar tidak bisa diajukan |
| Batas Jam Pengajuan | Untuk izin yang diajukan hari itu juga — lewat jam ini, pengajuan ditolak sampai besok |
| Batas Pengajuan per Bulan | Membatasi berapa kali sebulan |
| Mengurangi Tunjangan Kehadiran | Menentukan apakah izin ini memotong tunjangan kehadiran di payroll |

**Bawaan "Mengurangi Tunjangan Kehadiran":**

- **Tidak memotong** — Izin Cuti, Izin Sakit, Dispensasi, Izin Absen Luar
  Kantor, Cuti Bersalin, Cuti Khusus Haji/Umroh
- **Memotong** — Cuti Besar, Cuti Di Luar Tanggungan, Izin Pulang Cepat

**Pengaturan lain di halaman yang sama:**

- **Kop Surat Izin** — banner yang tampil di atas semua PDF cetak surat izin
- **Auto-Reject Izin Lembur 24 Jam** — saklar on/off (khusus SUPER_ADMIN)

---

## Alur Pemakaian

**Pegawai:**

1. **Ajukan Izin** → pilih jenis → isi form
2. Pantau di **Riwayat Izin**; notifikasi masuk saat pengajuan disetujui/ditolak
3. Kalau ditunjuk sebagai pengganti, konfirmasi lewat **Approval Center**

**Approver:**

1. Notifikasi masuk saat giliran tiba
2. Buka **Approval Center** → tinjau → Setujui / Tolak (alasan wajib saat menolak)

**Admin (HR):**

- **Riwayat Izin** (`/admin/riwayat-izin`) — seluruh pengajuan, bisa dicetak
  jadi PDF (format formal khusus untuk Cuti, Cuti Bersalin, Cuti Khusus, dan
  Cuti Besar di atas 3 hari; sisanya format generik)
- **Monitoring Izin** (`/admin/izin/monitoring`) — pemantauan lintas jenis
- **Saldo Cuti Pegawai** (`/admin/saldo-cuti`) — atur kuota & penyesuaian
- **Laporan** — rekap izin per periode

---

## Kaitan dengan Modul Lain

- **Absensi** — izin yang disetujui mencegah hari itu dihitung sebagai mangkir
- **Payroll** — pengaturan "Mengurangi Tunjangan Kehadiran" memengaruhi
  perhitungan Tunjangan Kehadiran di slip gaji
- **Saldo Cuti** — Cuti Tahunan memotong saldo; Dispensasi dan Cuti Khusus tidak

---

## Batasan yang Diketahui

1. **Tipe approver HR belum berfungsi** — selalu dilewati di runtime.
2. **Pegawai Pengganti belum berlaku di Izin Lembur** — selalu dilewati.
3. **Auto-reject lembur bergantung cron eksternal** — tidak berjalan sendiri
   dari dalam aplikasi.

---

## Referensi Kode

| Bagian | Berkas |
|---|---|
| Daftar jenis izin | `lib/leave-types.ts` |
| Aturan validasi per jenis | `lib/validations/*.ts` |
| Saldo & carry-over cuti | `lib/leave-balance.ts` |
| Pengaturan per jenis | `lib/izin-type-settings.ts` |
| Auto-reject lembur | `lib/overtime-auto-reject.ts` |
| Antrean approval | `lib/approval-queue.ts` |
| Cetak PDF surat izin | `lib/izin-print.ts` |
| Aksi per jenis izin | `server/actions/<jenis>.ts` |
