# Fitur Payroll

Dokumentasi modul Payroll pada HRIS Perumda BPR Bank Gresik. Ditulis dari kode
yang berjalan — kalau ada perbedaan dengan praktik di lapangan, kodenya yang
jadi acuan.

> **Catatan penting soal pajak.** Perhitungan PPh 21 di sistem ini memakai
> beberapa penyederhanaan yang disengaja (dijelaskan di bagian Pajak). Angkanya
> wajar untuk slip gaji, **tetapi bukan pengganti perhitungan resmi atau
> konsultasi pajak.**

---

## Menu

| Menu | Alamat | Isi |
|---|---|---|
| Komponen Gaji | `/admin/payroll/komponen-gaji` | Definisi komponen penerimaan & potongan |
| Struktur & Golongan Gaji | `/admin/payroll/struktur-gaji` | Golongan-ruang & tabel gaji pokok resmi |
| Proses Payroll | `/admin/payroll/proses` | Periode payroll: generate, approval, kunci |
| Slip Gaji Pegawai | `/admin/payroll/slip-gaji` | Penelusuran slip seluruh pegawai |
| BPJS & Pajak (PPh 21) | `/admin/payroll/pajak-bpjs` | Tarif BPJS, PTKP, metode & tarif pajak |
| Klaim Kesehatan | `/admin/payroll/klaim-kesehatan` | **Belum dibangun** (halaman kosong) |
| Pengaturan Payroll | `/admin/payroll/pengaturan` | Cut-off, kop surat, watermark, alur approval |

---

## Komponen Gaji

Tabel ini hanya memuat **definisi** komponen. Nilai per pegawai disimpan
terpisah.

### Kategori

| Kategori | Perlakuan |
|---|---|
| **Pendapatan Tetap** | Masuk hitungan Bruto — mis. Gaji Pokok, Tunjangan Jabatan |
| **Pendapatan Tidak Tetap** | **Di luar Bruto**, tampil sebagai "Penerimaan Lain" — mis. Insentif, Lembur, SPPD |
| **Potongan** | Mengurangi penerimaan |
| **Pinjaman** | Potongan cicilan |

### Cara Nominal Ditentukan

| Tipe | Cara kerja |
|---|---|
| **Nominal Tetap** | Diisi manual per pegawai, dipakai terus sampai diubah |
| **Persentase** | Dihitung dari persentase komponen lain |
| **Kehadiran** | Ditarik otomatis dari data absensi/izin |
| **Manual Periode** | Admin isi ulang tiap proses payroll — hanya muncul di slip kalau memang diisi |

### Tunjangan & Potongan Kehadiran

Bagian ini paling sering disalahpahami, jadi dijelaskan terpisah.

**Tunjangan Kehadiran** (Pendapatan, tipe Kehadiran) dihitung:

```
tarif per hari (dari Jabatan pegawai) × 22 hari kerja standar
```

Nilainya **selalu 22 hari penuh** — tidak pernah dikurangi walau pegawai
mangkir, cuti besar, atau pulang cepat.

**Potongan Kehadiran / Punishment** (Potongan, tipe Kehadiran) dihitung dengan
tarif per hari yang **sama**, dikalikan jumlah hari yang tidak tercakup
(mangkir, Cuti Besar, Cuti Di Luar Tanggungan, pulang cepat sebelum jam 12.00).

**Kenapa dipisah begitu:** kalau potongan kehadiran langsung mengurangi sisi
Pendapatan, maka Bruto ikut mengecil — padahal Bruto adalah dasar perhitungan
PPh 21 dan BPJS. Memisahkannya ke sisi Potongan membuat dasar pajak dan BPJS
tetap utuh.

Potongan ini juga bisa **ditambah nominal manual** untuk hukuman di luar data
absensi (misalnya SP). Nilai manual itu **ditambahkan** ke hasil otomatis,
bukan menggantikannya.

Komponen kehadiran **tidak perlu di-assign manual** per pegawai — otomatis
berlaku untuk semua pegawai yang jabatannya punya tarif.

---

## Struktur & Golongan Gaji

- **Golongan-Ruang** — misalnya golongan "C" ruang "1", dengan batas gaji
  minimum dan maksimum.
- **Versi tabel gaji pokok** — misalnya "PP No. 15 Tahun 2019". **Hanya boleh
  ada satu versi aktif** dalam satu waktu; versi aktif itulah yang jadi acuan.
- Tarif per golongan bisa diimpor dari Excel.

Golongan menempel langsung ke pegawai dan **tidak bergantung pada jabatan**.

---

## Proses Payroll

Inti modul ini. Satu periode payroll mewakili satu bulan pembayaran.

### Periode & Cut-off

Periode dihitung dari **tanggal cut-off** di Pengaturan Payroll (bawaan
tanggal 21). Untuk bulan pembayaran Agustus, periodenya 21 Juli – 20 Agustus.

Tanggal periode **disimpan saat periode dibuat**. Mengubah cut-off belakangan
tidak mengubah periode yang sudah ada.

### Status Periode

| Status | Arti |
|---|---|
| **Draft** | Payslip masih bisa di-generate ulang, diimpor, dan dihapus |
| **Menunggu Approval** | Sudah diajukan; generate & entri manual dibekukan |
| **Dikunci** | Final. Slip gaji terbit ke pegawai |
| **Menunggu Approval Koreksi** | Masih terkunci, ada permintaan membuka untuk diperbaiki |

### Mengisi Payslip

Dua cara, keduanya hanya bisa saat status Draft:

1. **Generate otomatis** — dihitung sistem dari komponen gaji, absensi, dan
   pajak.
2. **Import manual** — unduh template Excel (sudah berisi nama & jabatan tiap
   pegawai), isi nominalnya, lalu unggah. Dipakai kalau perhitungan bulan itu
   dilakukan manual oleh manajemen.

Keduanya **menimpa total** payslip periode itu.

### Alur Approval

Diatur di **Pengaturan Payroll** oleh SUPER_ADMIN, terpisah dari alur approval
izin. Ada **dua alur berbeda**:

- **Persetujuan Penguncian** — dijalankan saat HR mengajukan payroll.
- **Persetujuan Koreksi** — dijalankan saat HR minta membuka periode yang sudah
  terkunci. Bisa diisi pejabat yang lebih tinggi, karena yang diubah adalah
  data final yang sudah dilihat pegawai.

Penyetujunya adalah **pegawai yang ditunjuk namanya** — bukan berdasarkan
jabatan atau atasan, karena yang disetujui adalah periode, bukan pengajuan
milik seseorang.

**Alur lengkapnya:**

1. HR menyusun payslip (generate atau impor) saat Draft
2. HR menekan **Ajukan Approval** → penyetuju tahap 1 dapat notifikasi
3. Penyetuju membuka **halaman tinjauan read-only**: total bruto, potongan,
   yang dibayarkan, serta rincian per pegawai. Tidak ada satu pun tombol yang
   bisa mengubah angka
4. Setelah seluruh tahap menyetujui → periode **Dikunci** dan slip gaji
   otomatis terbit ke seluruh pegawai beserta notifikasinya

Kalau alur approval **belum diisi**, perilaku lama tetap berlaku: SUPER_ADMIN
memutuskan langsung tanpa tahapan. Ini disengaja supaya payroll tidak buntu
di instalasi yang belum sempat mengatur.

### Koreksi Setelah Terkunci

1. HR menekan **Ajukan Koreksi** dengan alasan wajib
2. Periode **tetap terkunci** sambil menunggu keputusan
3. Kalau disetujui, periode kembali ke Draft dan penghitung **"Dikoreksi N×"**
   bertambah
4. Setelah diperbaiki dan dikunci ulang, pegawai dapat notifikasi
   **"Slip Gaji Diperbarui"** — berbeda dari "Slip Gaji Tersedia" saat terbit
   pertama, supaya mereka tahu nominalnya berubah

### Override Darurat

SUPER_ADMIN tetap bisa memaksa kunci atau buka tanpa menunggu penyetuju —
untuk keadaan penyetuju berhalangan lama. Tapi:

- **Alasan wajib diisi**
- Tahap yang dilangkahi ditandai beserta alasannya
- Periode diberi label **"Override darurat N×"**
- Tercatat di Log Aktivitas

---

## Pajak & BPJS

### BPJS

Tarif iuran diatur terpisah untuk sisi pegawai dan perusahaan:

| Program | Pegawai | Perusahaan |
|---|---|---|
| Kesehatan | 1% | 4% |
| JHT | 2% | 3,7% |
| JP | 1% | 2% |
| JKK | — | 0,24% |
| JKM | — | 0,3% |

Angka di atas adalah bawaan dan bisa diubah. BPJS Kesehatan dan JP punya
**batas atas gaji** yang bisa diatur sendiri.

### PPh 21

- **Metode** bisa dipilih: Gross, Gross Up, Net, atau TER.
- **Status PTKP** (TK0–TK3, K0–K3) menempel di data pegawai; nominalnya
  disimpan di tabel supaya bisa diperbarui saat ada revisi peraturan tanpa
  perlu deploy ulang.
- **Tarif TER** dibagi kategori A, B, C, dipetakan otomatis dari status PTKP,
  dan bisa diimpor dari Excel.
- PPh 21 **selalu dihitung mesin payroll**, bukan diambil dari komponen gaji
  bernama "PPh 21" di master data — keduanya sengaja dipisah.

**Penyederhanaan yang disengaja:**

1. Biaya jabatan memakai aturan standar 5%, maksimal Rp 500.000/bulan.
2. Dasar pengenaan pajak **tidak dikurangi iuran BPJS pegawai** — nuansa ini
   butuh penanda tambahan per komponen yang belum tersedia.

---

## Slip Gaji

### Untuk Pegawai

Pegawai melihat slipnya di **Slip Gaji** (`/pegawai/slip-gaji`). Hanya periode
berstatus **Dikunci** yang tampil — selama masih Draft, slip belum terlihat
sama sekali.

Saat periode dikunci, seluruh pegawai yang punya slip di periode itu otomatis
mendapat notifikasi di lonceng dan Web Push.

### PDF

Slip bisa diunduh sebagai PDF, lengkap dengan **kop surat** dan **watermark**
yang keduanya diatur di Pengaturan Payroll. Watermark dikosongkan berarti
tidak dipasang.

### Untuk Admin

Menu **Slip Gaji Pegawai** menampilkan seluruh slip lintas pegawai dan
periode untuk penelusuran.

---

## Pengaturan Payroll

Khusus SUPER_ADMIN (`/admin/payroll/pengaturan`).

| Pengaturan | Fungsi |
|---|---|
| Tanggal cut-off | Awal periode baru (bawaan 21) |
| Tanggal pembayaran | Informasi tampilan saja, tidak dipakai perhitungan |
| Rekening bank perusahaan | Informasi tampilan |
| Kop surat | Banner di atas PDF slip gaji |
| Teks watermark | Watermark di PDF slip gaji |
| Alur approval payroll | Penyetuju tahap penguncian & koreksi |

---

## Laporan Terkait

| Laporan | Isi |
|---|---|
| **Data Gaji Kehadiran Pegawai** | Satu baris per pegawai: No, Nama, No HP, Gaji Kehadiran |
| **Rekap Lembur** | Rincian lembur beserta tarif, pajak, dan penerimaan |

---

## Kaitan dengan Modul Lain

| Sumber | Dipakai untuk |
|---|---|
| Jabatan (tarif kehadiran) | Tunjangan & Potongan Kehadiran |
| Absensi & Izin | Jumlah hari yang tidak tercakup (mangkir, pulang cepat) |
| Pengaturan Izin | Menentukan jenis izin mana yang memotong tunjangan kehadiran |
| Jam kerja pegawai | Deteksi mangkir pada hari kerja |
| Status PTKP & NPWP pegawai | Perhitungan PPh 21 |
| Golongan pegawai | Acuan gaji pokok |

---

## Batasan yang Diketahui

1. **Klaim Kesehatan belum dibangun** — menunya ada, tapi halamannya masih
   kosong.
2. **Perhitungan PPh 21 disederhanakan** — lihat bagian Pajak. Bukan pengganti
   perhitungan resmi.
3. **Tunjangan Kehadiran selalu dihitung 22 hari penuh**, pengurangannya
   ditempatkan di sisi Potongan. Ini disengaja demi menjaga dasar pajak, tapi
   perlu dipahami saat membaca slip.
4. **Alur approval payroll tidak aktif sampai diisi** — selama kosong,
   keputusan tetap langsung di tangan SUPER_ADMIN.

---

## Referensi Kode

| Bagian | Berkas |
|---|---|
| Mesin hitung payslip | `lib/payroll/calculate.ts` |
| Tunjangan/potongan kehadiran | `lib/payroll/attendance-allowance.ts` |
| Alur approval payroll | `lib/payroll/approval-flow.ts` |
| Aksi periode payroll | `server/actions/payroll-period.ts` |
| Aksi approval payroll | `server/actions/payroll-approval.ts` |
| Halaman tinjauan penyetuju | `app/pegawai/persetujuan-payroll/[id]/page.tsx` |
| Cetak slip gaji | `lib/reports/payslip-pdf.tsx`, `lib/payroll/payslip-print.ts` |
| Tarif pajak & BPJS | `lib/validations/payroll-tax.ts` |
