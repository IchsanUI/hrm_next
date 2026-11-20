# PRD — Masa Berlaku dan Penggantian Password

| | |
|---|---|
| **Modul** | Keamanan Akun |
| **Status dokumen** | Terimplementasi — nilai produksi (interval, dst.) menunggu kebijakan internal bank |
| **Tanggal** | 20 November 2026 |
| **Acuan utama** | PADK OJK Nomor 43/PADK.03/2025, Lampiran I, bagian Pengamanan Logic |
| **Pemangku kepentingan** | Direksi/pemilik kebijakan, TI, SuperAdmin, seluruh pengguna HRIS |

Dokumen ini menjelaskan mekanisme masa berlaku password di HRIS. Mekanismenya
sudah diimplementasikan (lihat **bagian 11**), tetapi **kebijakan masa berlaku
dibiarkan nonaktif** sampai Bank Gresik menetapkan nilainya. Durasi penggantian
password harus mengikuti kebijakan internal Bank Gresik; PADK 43 mewajibkan
penggantian secara berkala, tetapi tidak menetapkan jumlah hari tertentu.

---

## 1. Latar Belakang

HRIS saat ini menyediakan penggantian password mandiri dan reset password oleh
SuperAdmin, tetapi belum mencatat kapan password terakhir diubah dan belum
meminta pengguna mengganti password setelah jangka waktu tertentu.

PADK 43/PADK.03/2025 Lampiran I bagian **Pengamanan Logic** mengatur bahwa:

- pengguna wajib menjaga kerahasiaan password, menggunakan password yang
  berkualitas, menggantinya secara berkala, dan menghindari penggunaan ulang;
- sistem sedapat mungkin memaksa penggantian password setelah jangka waktu
  tertentu dan menolak password yang sama dengan yang digunakan sebelumnya;
- password awal wajib diganti pada login pertama.

PADK menyatakan aturan tersebut mulai berlaku satu tahun setelah ditetapkan
pada 17 Desember 2025. Karena itu, fitur ini perlu mendukung penerapan kebijakan
bank sebelum tanggal berlaku tersebut.

## 2. Tujuan

1. Mewajibkan pengguna HRIS mengganti password secara berkala sesuai kebijakan
   resmi Bank Gresik.
2. Memastikan password awal atau password hasil reset diganti pengguna pada
   login pertama.
3. Mencegah penggunaan ulang password sesuai batas riwayat yang disepakati.
4. Mencatat perubahan password dan tindakan administratif yang relevan untuk
   penelusuran.
5. Menjaga agar OTP/TOTP tetap menjadi faktor autentikasi terpisah dan tetap
   berjalan pada proses login.

## 3. Pengguna dan Peran

| Peran | Kebutuhan |
|---|---|
| **Pegawai / HR Admin / SuperAdmin** | Menerima pengingat, mengganti password ketika diminta, dan kembali login dengan password baru. |
| **SuperAdmin** | Mengelola masa berlaku sesuai kebijakan internal, melihat status password akun, serta melakukan reset bila diperlukan. |
| **Audit / TI** | Menelusuri waktu dan sumber perubahan tanpa dapat melihat password asli. |

## 4. Usulan Perilaku Fitur

### 4.1 Kebijakan masa berlaku

- Tambahkan pengaturan masa berlaku password pada area **Pengaturan Keamanan**
  yang hanya dapat dikelola SuperAdmin.
- Nilai interval harus ditetapkan oleh Bank Gresik. PADK 43 tidak menetapkan
  angka tertentu.
- Pengaturan menyimpan interval aktif dan tanggal mulai berlakunya kebijakan.
- Perubahan interval berlaku prospektif; perubahan tidak boleh diam-diam
  mengatur ulang tanggal perubahan password pengguna.

### 4.2 Pengingat dan kedaluwarsa

- Pengguna mendapat pemberitahuan sebelum password kedaluwarsa.
- Setelah kedaluwarsa, pengguna harus mengganti password sebelum dapat memakai
  fitur HRIS lainnya.
- Pengguna tetap dapat mengakses fungsi yang diperlukan untuk mengganti
  password, logout, dan menyelesaikan langkah autentikasi yang diwajibkan.
- Setelah berhasil mengganti password, sesi lama diakhiri dan pengguna login
  kembali menggunakan kredensial baru, mengikuti alur keamanan yang berlaku.

### 4.3 Password awal dan reset oleh admin

- Password awal dan password hasil reset admin ditandai **wajib diganti saat
  login pertama**.
- Reset admin tidak menampilkan atau mengirimkan password lama.
- Waktu perubahan password diperbarui setelah pengguna berhasil menetapkan
  password pengganti, bukan ketika admin memulai reset.

### 4.4 Riwayat password

- Password dan riwayatnya hanya disimpan dalam bentuk hash; password asli tidak
  pernah dicatat di log atau ditampilkan kembali.
- Sistem menolak password baru yang cocok dengan hash pada rentang riwayat yang
  ditetapkan bank.
- Jumlah riwayat password yang diperiksa perlu disepakati sebelum implementasi.

### 4.5 OTP/TOTP

- Password kedaluwarsa tidak menonaktifkan atau mereset TOTP.
- Pada login yang diwajibkan memakai TOTP, pengguna tetap menyelesaikan TOTP
  sesuai alur yang ditentukan sebelum atau selama proses perubahan password.
- Perubahan atau reset TOTP tetap mengikuti prosedur keamanan TOTP yang sudah
  ada.

## 5. Alur Utama

### Pengguna dengan password mendekati kedaluwarsa

1. Pengguna login seperti biasa, termasuk TOTP jika diwajibkan.
2. Sistem menampilkan pengingat beserta tanggal kedaluwarsa.
3. Pengguna dapat mengganti password dari pengaturan akun sebelum tenggat.

### Pengguna dengan password kedaluwarsa

1. Pengguna memasukkan kredensial dan menyelesaikan autentikasi yang diwajibkan.
2. Sistem mengarahkan pengguna ke halaman **Password Kedaluwarsa**.
3. Sistem menerima password baru setelah validasi kebijakan dan pengecekan
   riwayat password.
4. Sistem memperbarui waktu perubahan, mencatat aktivitas, mengakhiri sesi,
   lalu meminta pengguna login kembali.

### Pengguna dengan password awal/reset

1. Pengguna login dengan password awal yang diberikan secara aman.
2. Sistem mewajibkan penggantian sebelum akses HRIS lainnya diberikan.
3. Setelah penggantian berhasil, pengguna melanjutkan login normal.

## 6. Kebutuhan Fungsional

| ID | Kebutuhan |
|---|---|
| F-01 | Sistem menyimpan waktu terakhir password pengguna berhasil diubah. |
| F-02 | Sistem menghitung status belum pernah diganti, aktif, mendekati kedaluwarsa, atau kedaluwarsa. |
| F-03 | SuperAdmin dapat mengatur interval dan tanggal mulai kebijakan sesuai keputusan bank. |
| F-04 | Sistem memberi pengingat sebelum kedaluwarsa sesuai periode peringatan yang disepakati. |
| F-05 | Sistem memblokir akses aplikasi selain fungsi ganti password ketika password kedaluwarsa. |
| F-06 | Password awal dan hasil reset admin harus diganti sebelum akses normal diberikan. |
| F-07 | Sistem menolak password yang cocok dengan riwayat password yang masih disimpan. |
| F-08 | Perubahan password, reset admin, dan perubahan kebijakan dicatat di log aktivitas tanpa menyimpan password atau hash password dalam deskripsi log. |
| F-09 | OTP/TOTP dan perlindungan login yang sudah ada tetap berlaku. |
| F-10 | Password baru memenuhi aturan kualitas (min. 8 karakter, huruf besar, huruf kecil, angka, simbol) dan tidak memuat username/NIP. |
| F-11 | Setelah password diganti pengguna atau direset admin, seluruh sesi aktif akun tersebut di perangkat mana pun berakhir. |
| F-12 | Selama wajib ganti password, API dan unduhan (PDF/Excel) juga ditolak, bukan hanya halaman. |

## 7. Batasan dan Keamanan

- Tidak mengubah ataupun mengungkap password pengguna yang sudah ada.
- Tidak menonaktifkan OTP/TOTP, lockout login, atau kontrol akses berbasis peran.
- Pengecualian akun layanan/integrasi, bila ada, harus disetujui dan
  didokumentasikan; tidak dibuat otomatis.
- Periode kebijakan tidak ditetapkan oleh pengembang. Nilai produksi harus
  berasal dari kebijakan internal yang disetujui pihak berwenang.
- Migrasi awal tidak dapat mengetahui tanggal historis perubahan password akun
  yang sudah ada. Tanggal awal penerapan bagi akun lama perlu ditetapkan agar
  seluruh pengguna tidak mendadak terkunci pada hari aktivasi.

## 8. Kriteria Penerimaan

1. Password tidak pernah tampil kembali setelah dibuat atau direset.
2. Password awal/reset tidak dapat dipakai untuk membuka fitur HRIS sebelum
   diganti.
3. Pengguna yang masih dalam masa berlaku dapat login dan menggunakan HRIS
   sesuai hak aksesnya.
4. Pengguna yang memasuki masa pengingat melihat informasi tenggat yang benar.
5. Pengguna yang kedaluwarsa hanya dapat membuka alur ganti password, logout,
   dan langkah autentikasi yang diperlukan.
6. Setelah penggantian sukses, password lama tidak dapat digunakan dan sesi
   lama tidak tetap aktif.
7. Password yang masuk dalam rentang riwayat yang dikonfigurasi ditolak.
8. TOTP SuperAdmin dan mekanisme lockout login tetap berfungsi.
9. Log aktivitas menunjukkan siapa melakukan tindakan dan kapan, tanpa memuat
   kredensial sensitif.
10. Perhitungan interval menggunakan zona waktu dan batas tanggal yang
    konsisten.

## 9. Pertanyaan untuk Review

| No. | Keputusan yang dibutuhkan | Usulan awal |
|---|---|---|
| 1 | Berapa interval penggantian password yang ditetapkan Bank Gresik? | Menunggu kebijakan internal; tidak ditentukan PADK. |
| 2 | Berapa hari sebelum tenggat pengingat mulai muncul? | 14 hari, dapat disesuaikan. |
| 3 | Berapa password terdahulu yang ditolak saat pengguna membuat password baru? | 5 password terakhir, jika disetujui TI/audit. |
| 4 | Kapan kebijakan mulai berlaku bagi akun lama? | Tanggal aktivasi kebijakan menjadi tanggal dasar, lalu interval penuh diberikan sebelum kewajiban pertama. |
| 5 | Apakah semua akun termasuk SuperAdmin dan HR Admin mengikuti interval yang sama? | Ya; pengecualian hanya bila ada alasan dan persetujuan tertulis. |
| 6 | Apakah SuperAdmin boleh memaksa reset password pengguna tertentu? | Ya, mengikuti alur reset admin yang ada dan wajib ganti saat login berikutnya. |

## 10. Keputusan Implementasi

| No. | Topik | Keputusan |
|---|---|---|
| 1 | Rumus tenggat | `tenggat = max(passwordChangedAt, tanggal mulai berlaku) + interval`. Akun lama (passwordChangedAt = tanggal migrasi) mendapat interval penuh sejak kebijakan berlaku. |
| 2 | Kebijakan belum ditetapkan | Interval kosong = masa berlaku **nonaktif**. Password awal/reset tetap wajib diganti dan riwayat tetap dicek. |
| 3 | Status di sesi | Status `MUST_CHANGE`/`EXPIRED` dihitung ulang dari basis data setiap request (callback `jwt`) dan dibawa di token; `proxy.ts` memblokir halaman & API. |
| 4 | Pencabutan sesi | Sesi JWT memakai klaim `loginAt` (bukan `iat`, yang diperbarui tiap request). Sesi dengan `loginAt` sebelum `passwordChangedAt`/`sessionsRevokedAt` ditolak. |
| 5 | Reset admin | Password lama masuk riwayat, akun ditandai wajib ganti, sesi aktif dicabut; `passwordChangedAt` baru diperbarui saat pengguna menetapkan password pengganti. |
| 6 | Riwayat | Jumlah N mencakup password yang sedang dipakai (N = 5 → password saat ini + 4 sebelumnya). Hanya hash bcrypt yang disimpan. |
| 7 | Urutan pemblokiran | Setup 2FA SuperAdmin lebih dulu, lalu ganti password. Halaman `/ganti-password` menyediakan tombol keluar. |
| 8 | Pengingat | Banner di seluruh halaman selama masa pengingat, dengan tautan ke Pengaturan Akun. |
| 9 | Akun hasil migrasi HRM lama | Akun dengan password lemah/teks biasa diimpor dengan tanda wajib ganti. |

## 11. Lokasi Implementasi

| Bagian | Berkas |
|---|---|
| Aturan status & riwayat | `lib/password-policy.ts` |
| Status di sesi & pencabutan sesi | `auth.ts`, `auth.config.ts`, `types/next-auth.d.ts` |
| Pemblokiran halaman & API | `proxy.ts` |
| Halaman wajib ganti | `app/ganti-password/page.tsx`, `components/password-change-form.tsx` |
| Ganti password / reset admin / akun baru | `server/actions/account.ts`, `server/actions/user-management.ts`, `server/actions/employees.ts` |
| Pengaturan kebijakan (SuperAdmin) | `app/admin/keamanan/kebijakan/page.tsx` (Kebijakan Keamanan Akun), `server/actions/password-policy.ts` |
| Pengingat & status | `components/password-expiry-banner.tsx`, kolom Password di Manajemen Pengguna |
| Basis data | migrasi `20261120120000_password_policy`, `20261120140000_password_policy_sessions` |

---

## 12. Acuan

- PADK OJK Nomor 43/PADK.03/2025, Lampiran I, bagian **Pengamanan Logic**,
  khususnya ketentuan password awal, penggantian berkala, penggunaan ulang,
  serta pemaksaan perubahan password setelah jangka waktu tertentu.
- SEOJK OJK Nomor 15/SEOJK.03/2017 sebagai ketentuan yang berlaku sebelum
  PADK 43 mulai berlaku dan dicabut.
- Kebijakan keamanan informasi dan password internal Bank Gresik (perlu
  dikonfirmasi sebelum nilai produksi ditetapkan).
