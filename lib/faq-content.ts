// Isi Pusat Bantuan (FAQ). Ditulis dari aturan yang benar-benar dijalankan
// sistem (lihat juga docs/fitur-*.md). Kalau aturan di kode berubah, ubah
// jawabannya di sini juga.
//
// Format jawaban: daftar blok. String biasa = paragraf; **teks** = tebal.

export type FaqBlock =
  | string
  | { list: string[] }
  | { steps: string[] }
  | { note: string }
  | { table: { head: [string, string]; rows: [string, string][] } }

export type FaqItem = { q: string; a: FaqBlock[] }

export type FaqAudience = "pegawai" | "petugas" | "admin" | "superadmin"

// Peran tambahan pegawai (bukan role akun). Topik audience "petugas" hanya
// tampil bagi pegawai yang memegang peran ini; admin melihat semuanya.
export type FaqStaffRole = "vehiclePetugas" | "vehicleSopir"

export type FaqIcon =
  | "account"
  | "attendance"
  | "leave"
  | "approval"
  | "payslip"
  | "profile"
  | "team"
  | "library"
  | "issue"
  | "employees"
  | "leaveAdmin"
  | "payroll"
  | "health"
  | "access"
  | "users"
  | "monitoring"
  | "storage"
  | "backup"
  | "archive"
  | "vehicle"
  | "vehicleStaff"
  | "driver"

export type FaqTopic = {
  id: string
  title: string
  description: string
  icon: FaqIcon
  audience: FaqAudience
  /** Untuk audience "petugas": peran yang dibutuhkan agar topik tampil. */
  staffRole?: FaqStaffRole
  link?: { href: string; label: string }
  items: FaqItem[]
}

export const FAQ_TOPICS: FaqTopic[] = [
  // ───────────────────────────── PEGAWAI ─────────────────────────────
  {
    id: "akun",
    title: "Akun & Login",
    description: "Masuk, kata sandi, dan akun terkunci",
    icon: "account",
    audience: "pegawai",
    link: { href: "/pegawai/pengaturan", label: "Buka Pengaturan Akun" },
    items: [
      {
        q: "Saya lupa kata sandi. Bagaimana cara meresetnya?",
        a: [
          "Sistem belum menyediakan reset kata sandi mandiri lewat email. Hubungi **Super Admin**, yang bisa mengatur ulang kata sandi Anda lewat menu Manajemen Pengguna.",
          "Setelah berhasil masuk dengan kata sandi baru, segera ganti dengan kata sandi pribadi di **Pengaturan Akun**.",
        ],
      },
      {
        q: "Kenapa akun saya terkunci?",
        a: [
          "Akun otomatis dikunci setelah **5 kali salah memasukkan kata sandi**. Kunci ini tidak terbuka sendiri. Minta **Super Admin** membukanya di Manajemen Pengguna.",
          "Selain itu, perangkat/jaringan yang berulang kali gagal login harus menunggu bertahap (30 detik, 2 menit, lalu 5 menit) sebelum boleh mencoba lagi, dan pada akhirnya diblokir. Blokir ini juga hanya bisa dibuka Super Admin.",
        ],
      },
      {
        q: "Bagaimana cara mengganti username, kata sandi, atau foto akun?",
        a: [
          "Buka **Pengaturan Akun**. Di sana Anda bisa mengganti username, kata sandi, dan foto akun.",
          { note: "Foto akun berbeda dari foto resmi kepegawaian. Foto resmi di data pegawai hanya bisa diubah HR." },
        ],
      },
      {
        q: "Kenapa saya diminta mengganti kata sandi saat login?",
        a: [
          "Ada dua kemungkinan:",
          {
            list: [
              "**Akun baru atau kata sandi baru saja direset** Super Admin. Kata sandi sementara wajib diganti dengan kata sandi pribadi.",
              "**Masa berlaku kata sandi habis.** Jika Super Admin memberlakukan masa berlaku (mis. 90 hari), kata sandi harus diganti setelah jangka waktu itu.",
            ],
          },
          "Selama belum diganti, menu lain tidak bisa dibuka. Setelah diganti, Anda diminta login ulang. Beberapa hari sebelum kedaluwarsa, muncul **pita peringatan** di bagian atas halaman; ganti lebih awal lewat Pengaturan Akun agar tidak terhalang.",
          { note: "Kata sandi baru tidak boleh sama dengan beberapa kata sandi terakhir, dan tidak boleh memuat username atau NIP Anda." },
        ],
      },
      {
        q: "Kenapa saya tiba-tiba keluar (logout) sendiri?",
        a: [
          "Demi keamanan, sistem otomatis logout jika **tidak ada aktivitas** selama waktu yang diatur Super Admin (standarnya **15 menit**). Sesaat sebelumnya muncul jendela hitung mundur; klik **Tetap Masuk** untuk melanjutkan.",
          "Aktivitas di tab lain aplikasi yang sama ikut dihitung, jadi membuka beberapa tab tidak membuat Anda logout lebih cepat.",
          "Anda juga otomatis keluar dari semua perangkat setelah mengganti kata sandi atau setelah kata sandi direset admin.",
        ],
      },
      {
        q: "Bagaimana mengetahui kapan dan di perangkat mana akun saya dipakai?",
        a: [
          "Buka **Aktivitas Login** (menu samping atau menu akun di kanan atas). Di sana tercatat 90 hari terakhir: waktu login/logout, perangkat dan browser, alamat IP, serta percobaan login yang gagal. Perangkat yang sedang Anda pakai ditandai **Perangkat ini**.",
        ],
      },
      {
        q: "Ada login yang bukan saya. Apa yang harus dilakukan?",
        a: [
          {
            steps: [
              "Di **Aktivitas Login**, klik **Ini bukan saya** pada baris yang mencurigakan, lalu kirim laporannya. Super Admin langsung mendapat notifikasi untuk menindaklanjuti.",
              "Segera **ganti kata sandi** di Pengaturan Akun. Semua perangkat lain otomatis ikut keluar.",
            ],
          },
          "Untuk masalah lain terkait login, gunakan tombol **Laporkan Kendala** di halaman yang sama.",
        ],
      },
      {
        q: "Bisakah aplikasi dipasang di HP?",
        a: [
          "Bisa. Saat membuka aplikasi lewat browser HP, akan muncul tawaran **Install Sekarang**. Setelah dipasang, aplikasi bisa dibuka dari layar utama dan mengirim notifikasi seperti aplikasi biasa.",
        ],
      },
    ],
  },
  {
    id: "absensi",
    title: "Absensi",
    description: "Fingerprint, lupa absen, dan dinas luar",
    icon: "attendance",
    audience: "pegawai",
    link: { href: "/pegawai/absensi", label: "Buka Riwayat Absensi" },
    items: [
      {
        q: "Dari mana data absensi saya berasal?",
        a: [
          "Dari **mesin fingerprint** kantor. Data tap masuk dan pulang ditarik ke sistem lalu ditampilkan di **Riwayat Absensi**, lengkap dengan status Terlambat atau Pulang Cepat berdasarkan jam kerja Anda.",
        ],
      },
      {
        q: "Saya lupa absen datang atau pulang. Apa yang harus dilakukan?",
        a: [
          "Ajukan **Izin Tidak Absen Datang/Pulang**. Ini berupa pernyataan resmi yang disetujui atasan dan Direksi, supaya hari itu tidak dianggap mangkir.",
        ],
      },
      {
        q: "Saya dinas ke luar kantor sehingga tidak bisa absen fingerprint.",
        a: [
          "Ajukan **Izin Absen Diluar Kantor**. Kalau hanya keluar sebentar saat jam kerja (urusan dinas atau pribadi), gunakan **Izin Meninggalkan Kantor**.",
        ],
      },
      {
        q: "Saya datang terlambat. Perlu mengajukan izin?",
        a: [
          "Ya, ajukan **Izin Terlambat** pada hari itu juga. Perhatikan batas jam pengajuannya. Lewat dari batas jam yang diatur HR, pengajuan untuk hari itu ditolak sistem.",
        ],
      },
    ],
  },
  {
    id: "izin",
    title: "Pengajuan Izin & Cuti",
    description: "Jenis izin, syarat, dan aturan pengisian",
    icon: "leave",
    audience: "pegawai",
    link: { href: "/pegawai/ajukan-izin", label: "Buka Ajukan Izin" },
    items: [
      {
        q: "Bagaimana alur pengajuan izin?",
        a: [
          {
            steps: [
              "Buka **Ajukan Izin**, pilih jenis izin, lalu isi formnya.",
              "Pengajuan diteruskan ke approver sesuai urutan yang diatur HR (umumnya Atasan Langsung → Kepala Bagian → pejabat berikutnya).",
              "Tiap approver mendapat notifikasi saat gilirannya tiba dan memprosesnya di **Approval Center**.",
              "Anda mendapat notifikasi saat pengajuan disetujui atau ditolak. Statusnya bisa dipantau di **Riwayat Izin**.",
            ],
          },
          "Kalau satu approver menolak, tahap sesudahnya otomatis dibatalkan. Alasan penolakan wajib diisi sehingga Anda bisa membacanya.",
        ],
      },
      {
        q: "Jenis izin apa saja yang tersedia?",
        a: [
          {
            table: {
              head: ["Jenis", "Dipakai untuk"],
              rows: [
                ["Izin Cuti", "Cuti tahunan"],
                ["Izin Sakit", "Tidak masuk karena sakit"],
                ["Izin Terlambat", "Datang terlambat (diajukan hari itu)"],
                ["Izin Pulang Cepat", "Pulang sebelum jam kerja berakhir"],
                ["Izin Meninggalkan Kantor", "Keluar sementara saat jam kerja"],
                ["Izin Lembur", "Kerja di luar jam kerja"],
                ["Dispensasi", "Kejadian khusus (menikah, duka, dll.)"],
                ["Cuti Bersalin / Gugur Kandungan", "Melahirkan atau keguguran"],
                ["Cuti Besar", "Masa kerja panjang, 1 bulan per pengajuan"],
                ["Cuti Khusus (Haji/Umroh)", "Ibadah haji atau umroh"],
                ["Cuti Di Luar Tanggungan", "Cuti tanpa gaji, maks. 3 bulan"],
                ["Izin Absen Diluar Kantor", "Dinas sehingga tidak bisa absen"],
                ["Izin Tidak Absen", "Lupa absen datang/pulang"],
              ],
            },
          },
          "Jenis yang sedang ditutup HR tidak bisa dipilih.",
        ],
      },
      {
        q: "Berapa jatah cuti tahunan saya dan bagaimana menghitungnya?",
        a: [
          {
            list: [
              "Kuota **12 hari per tahun**. HR bisa menambah atau mengurangi per pegawai dengan catatan alasan.",
              "Sisa cuti tahun lalu terbawa **maksimal 6 hari** dan hanya berlaku sampai **31 Maret**. Lewat tanggal itu, sisa bawaan hangus.",
              "**Sabtu, Minggu, dan hari libur nasional tidak dihitung** sebagai pemakaian cuti.",
              "Pegawai yang mengambil **Cuti Besar** di suatu tahun tidak mendapat Cuti Tahunan di tahun itu.",
            ],
          },
        ],
      },
      {
        q: "Apa saja aturan pengisian Izin Cuti?",
        a: [
          {
            list: [
              "Tanggal mulai tidak boleh tanggal yang sudah lewat.",
              "Cuti **lebih dari 3 hari** wajib melampirkan dokumen pendukung dan melewati pemeriksaan HR tambahan.",
              "Cuti **3 hari atau kurang** tidak memerlukan dokumen.",
              "Anda bisa memilih **Pegawai Pengganti**. Orang yang dipilih akan diminta konfirmasi bersedia atau tidak.",
            ],
          },
        ],
      },
      {
        q: "Apa yang terjadi kalau Pegawai Pengganti saya menolak?",
        a: [
          "Status pengajuan berubah menjadi **Revisi**. Buka pengajuan itu di Riwayat Izin dan pilih pengganti lain. Kalau Anda tidak memilih pengganti sama sekali, tahap ini dilewati.",
          "Pegawai Pengganti tersedia di Cuti, Sakit, Dispensasi, Cuti Bersalin, Cuti Besar, Cuti Khusus, dan Cuti Di Luar Tanggungan.",
        ],
      },
      {
        q: "Apakah Izin Sakit wajib melampirkan surat dokter?",
        a: [
          "Ya, Surat Keterangan Sakit/Dokter wajib dilampirkan, tetapi **boleh menyusul**. Pengajuan tetap bisa diproses approver tanpa menunggu lampiran.",
        ],
      },
      {
        q: "Berapa lama Dispensasi untuk tiap keperluan?",
        a: [
          "Dispensasi tetap digaji penuh dan **tidak memotong saldo cuti**. Sabtu, Minggu, dan libur nasional tidak dihitung.",
          {
            table: {
              head: ["Keperluan", "Durasi"],
              rows: [
                ["Pegawai menikah", "3 hari"],
                ["Suami/istri, anak meninggal", "2 hari"],
                ["Orang tua/mertua meninggal", "2 hari"],
                ["Menikahkan anak", "2 hari"],
                ["Istri melahirkan atau keguguran", "2 hari"],
                ["Mengkhitankan anak", "2 hari"],
                ["Anggota keluarga serumah meninggal", "1 hari"],
                ["Pindah rumah", "1 hari"],
                ["Melayat, panggilan instansi, mengurus SIM, ujian kuliah", "Waktu wajar (dinilai approver)"],
              ],
            },
          },
        ],
      },
      {
        q: "Apa syarat Cuti Besar, Cuti Khusus, dan Cuti Di Luar Tanggungan?",
        a: [
          {
            list: [
              "**Cuti Besar**: 1 bulan per pengajuan, maksimal 2 kali. Pengajuan pertama minimal masa kerja 6 tahun, pengajuan kedua minimal 7 tahun.",
              "**Cuti Khusus**: Haji maksimal 40 hari, Umroh maksimal 20 hari, gaji penuh, masing-masing **1 kali selama masa kerja**.",
              "**Cuti Di Luar Tanggungan**: masa kerja minimal 10 tahun, maksimal 3 bulan, diajukan **paling lambat 1 bulan sebelum** tanggal mulai, tanpa gaji.",
            ],
          },
        ],
      },
      {
        q: "Bagaimana Cuti Bersalin dihitung?",
        a: [
          "Cukup isi satu tanggal acuan, sistem menghitung durasinya:",
          {
            list: [
              "**Cuti Bersalin**: 45 hari sebelum dan 45 hari sesudah tanggal perkiraan lahir (HPL).",
              "**Gugur Kandungan**: 45 hari sejak tanggal kejadian.",
            ],
          },
          "Surat keterangan dokter wajib dilampirkan.",
        ],
      },
      {
        q: "Bagaimana alur Izin Lembur?",
        a: [
          {
            steps: [
              "Ajukan rencana lembur. Lokasi Anda saat mengajukan direkam, jadi izinkan akses lokasi di browser.",
              "Setelah lembur selesai, lengkapi laporan hasil lembur (boleh dengan foto).",
            ],
          },
          { note: "Bila fitur auto-tolak diaktifkan, rencana lembur yang tidak diproses Atasan Langsung/Kepala Bagian dalam 24 jam sejak diajukan otomatis ditolak, termasuk saat akhir pekan." },
        ],
      },
      {
        q: "Kenapa pengajuan saya ditolak sistem padahal formnya sudah diisi?",
        a: [
          "Biasanya karena salah satu batasan yang diatur HR:",
          {
            list: [
              "Lewat **batas jam pengajuan** untuk izin harian (Terlambat, Pulang Cepat, Meninggalkan Kantor).",
              "Sudah mencapai **batas pengajuan per bulan** untuk jenis itu.",
              "Saldo cuti tidak cukup, atau syarat masa kerja belum terpenuhi.",
              "Jenis izin sedang dinonaktifkan.",
            ],
          },
          "Pesan di form menjelaskan alasannya. Kalau masih bingung, kirim lewat **Laporkan Kendala**.",
        ],
      },
      {
        q: "Apakah izin memengaruhi Tunjangan Kehadiran?",
        a: [
          "Tergantung jenisnya dan pengaturan HR. Secara bawaan:",
          {
            list: [
              "**Tidak memotong**: Izin Cuti, Izin Sakit, Dispensasi, Izin Absen Diluar Kantor, Cuti Bersalin, Cuti Khusus.",
              "**Memotong**: Cuti Besar, Cuti Di Luar Tanggungan, Izin Pulang Cepat.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "approval",
    title: "Approval Center",
    description: "Menyetujui pengajuan tim dan konfirmasi pengganti",
    icon: "approval",
    audience: "pegawai",
    link: { href: "/pegawai/approval-center", label: "Buka Approval Center" },
    items: [
      {
        q: "Siapa yang perlu membuka Approval Center?",
        a: [
          "Pegawai yang menjadi approver (atasan, kepala bagian, direksi, atau pejabat yang ditunjuk), serta pegawai yang dipilih rekannya sebagai **Pegawai Pengganti**. Jumlah yang menunggu tampil sebagai angka di menu.",
        ],
      },
      {
        q: "Bisakah menyetujui banyak pengajuan sekaligus?",
        a: [
          "Bisa. Centang pengajuan yang ingin disetujui (atau centang semua), klik **Setujui Terpilih**, lalu ketik **SETUJU** untuk konfirmasi.",
          { note: "Persetujuan payroll dan konfirmasi Pegawai Pengganti tidak bisa diproses massal karena perlu ditinjau satu per satu." },
        ],
      },
      {
        q: "Apakah saya bisa menyetujui pengajuan saya sendiri?",
        a: ["Tidak. Kalau Anda sendiri pejabat di salah satu tahap, tahap itu otomatis dilewati."],
      },
    ],
  },
  {
    id: "slip-gaji",
    title: "Slip Gaji",
    description: "Kapan slip terbit dan cara mengunduhnya",
    icon: "payslip",
    audience: "pegawai",
    link: { href: "/pegawai/slip-gaji", label: "Buka Slip Gaji" },
    items: [
      {
        q: "Kapan slip gaji bisa dilihat?",
        a: [
          "Setelah payroll periode itu **dikunci** (disetujui seluruh tahap). Anda akan mendapat notifikasi **Slip Gaji Tersedia**. Selama masih disusun HR, slip belum terlihat.",
        ],
      },
      {
        q: "Slip gaji saya berubah setelah terbit. Kenapa?",
        a: [
          "Berarti ada koreksi payroll yang sudah disetujui. Anda akan mendapat notifikasi **Slip Gaji Diperbarui**. Kalau ada angka yang menurut Anda keliru, tanyakan ke HR.",
        ],
      },
      {
        q: "Bisakah slip diunduh?",
        a: ["Bisa, sebagai PDF lengkap dengan kop surat dan watermark perusahaan."],
      },
    ],
  },
  {
    id: "klaim-kesehatan",
    title: "Klaim Kesehatan",
    description: "Mengajukan penggantian biaya berobat dan memantau plafon",
    icon: "health",
    audience: "pegawai",
    link: { href: "/pegawai/klaim-kesehatan", label: "Buka Klaim Kesehatan" },
    items: [
      {
        q: "Siapa saja yang bisa saya klaimkan?",
        a: [
          "Anda sendiri, suami/istri, dan anak yang **terdaftar di data Keluarga** HRIS. Jika anggota keluarga belum muncul di pilihan pasien, minta HR menambahkannya ke data Keluarga.",
          { note: "Hak klaim tergantung status kepegawaian. Saat ini pegawai Tetap dan Kontrak berhak, sedangkan pegawai Training belum. Klaim juga harus diajukan dalam batas hari setelah tanggal berobat; tanggal di luar batas tidak bisa dipilih di formulir." },
        ],
      },
      {
        q: "Berapa plafon saya dan bagaimana menghitung sisanya?",
        a: [
          "Plafon ditentukan per periode (satu tahun) berdasarkan jabatan sesuai SK, dan **dipakai bersama sekeluarga**. Kartu plafon di halaman Klaim Kesehatan menampilkan:",
          {
            table: {
              head: ["Angka", "Arti"],
              rows: [
                ["Terpakai", "Klaim yang sudah disetujui atau dibayar"],
                ["Sedang diproses", "Klaim yang masih diperiksa atau menunggu persetujuan. Ikut mengurangi sisa supaya plafon tidak terlampaui"],
                ["Sisa", "Plafon dikurangi terpakai dan sedang diproses"],
              ],
            },
          },
          "Periode plafon mengikuti **tanggal berobat**, bukan tanggal pengajuan. Awal periode (mis. Januari–Desember atau Maret–Februari) ditentukan HR; sisa plafon direset setiap awal periode.",
        ],
      },
      {
        q: "Bagaimana cara mengajukan klaim?",
        a: [
          {
            steps: [
              "Buka **Klaim Kesehatan**, lalu klik **Ajukan Klaim**.",
              "Pilih pasien dan jenis klaim, lalu isi tanggal berobat dan nama fasilitas kesehatan.",
              "Isi **total** biaya yang diklaim sesuai kuitansi. Rinciannya diperiksa petugas.",
              "Unggah foto atau scan kuitansi/nota beserta dokumen pendukungnya (maksimal 5 file). Pastikan dokumen utuh, terang, dan terbaca jelas karena akan diarsipkan.",
              "Centang pernyataan, lalu klik **Kirim Klaim**.",
            ],
          },
          "Klaim lalu diperiksa petugas. Setelah terkumpul klaim dari beberapa pegawai, petugas mengajukannya ke Direktur dalam satu Nota Dinas.",
        ],
      },
      {
        q: "Bagaimana dengan biaya yang ditanggung BPJS?",
        a: [
          "Pengurusan BPJS adalah administrasi pribadi pegawai. Cukup klaimkan biaya yang Anda bayar sendiri sesuai kuitansi; petugas akan memeriksa dan menentukan nominal yang bisa diganti sesuai ketentuan.",
        ],
      },
      {
        q: "Bagaimana jika klaim saya melebihi sisa plafon?",
        a: [
          "Klaim tetap bisa diajukan, tetapi yang dibayar **paling banyak sebesar sisa plafon**. Nominal akhir juga bisa disesuaikan petugas bila ada item di nota yang tidak bisa diklaim, dan alasannya akan terlihat di detail klaim.",
        ],
      },
      {
        q: "Klaim saya diminta revisi. Apa yang harus dilakukan?",
        a: [
          "Buka detail klaim untuk membaca catatan petugas, lalu klik **Perbaiki Klaim**. Ubah data yang diminta, tambahkan atau hapus bukti, lalu klik **Kirim Perbaikan**. Klaim akan diperiksa ulang tanpa kehilangan urutan pengajuannya.",
        ],
      },
      {
        q: "Kapan klaim saya dibayar?",
        a: [
          "Setelah klaim dikonfirmasi petugas, klaim diajukan ke Direksi bersama klaim pegawai lain dalam satu Nota Dinas. Setelah Direksi menyetujui, Accounting **mentransfer** ke rekening Anda yang tercatat di data pegawai. Anda menerima notifikasi di setiap tahap, dan status terbaru selalu terlihat di detail klaim.",
        ],
      },
      {
        q: "Apakah klaim bisa dibatalkan?",
        a: [
          "Bisa, selama klaim belum dikonfirmasi petugas. Buka detail klaim lalu klik **Batalkan Klaim**. Plafon yang tertahan akan dikembalikan.",
        ],
      },
    ],
  },
  {
    id: "profil",
    title: "Profil & Data Pribadi",
    description: "Mengubah data diri dan dokumen",
    icon: "profile",
    audience: "pegawai",
    link: { href: "/pegawai/profil", label: "Buka Profil Saya" },
    items: [
      {
        q: "Data saya ada yang salah. Bisa saya ubah sendiri?",
        a: [
          "Data kepegawaian diubah oleh HR. Sesekali HR membuka **Update Data Mandiri** untuk Anda. Saat itu Anda mendapat notifikasi, dan di Profil Saya muncul pemberitahuan beserta tombol menuju halaman **Update Data**.",
          "HR menentukan bagian mana saja yang boleh Anda ubah, misalnya:",
          {
            list: [
              "Kontak (No HP, email, No HP urgent) dan alamat",
              "Media sosial, data pribadi umum, dan pendidikan terakhir",
              "Rekening bank untuk transfer gaji/klaim",
              "**Pas foto** resmi",
              "**Scan KTP, KK, dan NPWP**",
            ],
          },
          "Data yang hanya boleh diubah HR (NIP, jabatan, status kepegawaian, tanggal masuk, gaji, dan sejenisnya) tidak bisa diubah sendiri. Sampaikan koreksinya ke HR.",
        ],
      },
      {
        q: "Bagaimana cara memakai halaman Update Data?",
        a: [
          {
            steps: [
              "Buka **Update Data** dari pemberitahuan di Profil Saya atau dari notifikasi.",
              "Periksa dan perbaiki kolom yang terbuka. Kolom bertanda * wajib diisi.",
              "Pas foto dan dokumen (KTP/KK/NPWP) langsung tersimpan begitu diunggah. Pas foto otomatis dipotong persegi; ukuran file maksimal 5 MB.",
              "Klik **Simpan & Selesai**.",
            ],
          },
          { note: "Setelah Simpan & Selesai, kesempatan update **langsung ditutup** dan HR menerima ringkasan perubahan Anda. Pastikan semua sudah benar sebelum menyimpan. Jika ada yang terlewat, minta HR membukanya lagi." },
        ],
      },
      {
        q: "Di mana saya melihat sertifikasi dan pelatihan wajib saya?",
        a: [
          "Di **Profil Saya**, bagian **Sertifikasi & Pelatihan**. Di sana terlihat kewajiban sesuai jabatan Anda dan sertifikat yang sudah dicatat HR beserta masa berlakunya.",
          "Anda akan mendapat notifikasi menjelang sertifikat kedaluwarsa. Serahkan sertifikat hasil perpanjangan ke HR agar dicatat.",
        ],
      },
      {
        q: "Siapa yang bisa melihat scan KTP, KK, dan NPWP saya?",
        a: [
          "Hanya Anda dan admin HR. File disimpan di luar folder publik dan hanya bisa dibuka setelah login. Saat dibuka, dokumen diberi **watermark** berisi nama pembuka dan waktunya, dan setiap pembukaan dicatat di log.",
        ],
      },
    ],
  },
  {
    id: "ruang-tim",
    title: "Ruang Tim",
    description: "Berbagi kabar dan menandai rekan",
    icon: "team",
    audience: "pegawai",
    link: { href: "/pegawai/ruang-tim", label: "Buka Ruang Tim" },
    items: [
      {
        q: "Bagaimana cara menandai (mention) rekan?",
        a: [
          "Ketik **@** lalu nama rekan dan pilih dari daftar. Rekan yang ditandai mendapat notifikasi.",
          "Ketik **@all** untuk menandai **semua rekan satu bagian** sekaligus. Pegawai di bagian lain tidak menerima notifikasi.",
        ],
      },
    ],
  },
  {
    id: "perpustakaan",
    title: "Perpustakaan",
    description: "Membaca peraturan OJK, peraturan perusahaan, dan SOP",
    icon: "library",
    audience: "pegawai",
    link: { href: "/pegawai/perpustakaan", label: "Buka Perpustakaan" },
    items: [
      {
        q: "Apa isi Perpustakaan?",
        a: [
          "Dokumen bacaan resmi dalam bentuk PDF: **Peraturan OJK** (POJK/SEOJK), **Peraturan Perusahaan**, **SOP**, dan **Surat Edaran**. Dokumen bisa dibaca langsung di aplikasi atau diunduh.",
        ],
      },
      {
        q: "Apakah HR tahu saya sudah membaca dokumen?",
        a: [
          "Ya. Saat Anda membuka dokumen, sistem mencatat bahwa Anda sudah membacanya. HR memakai catatan ini sebagai bukti sosialisasi aturan.",
          "Dokumen yang belum pernah Anda buka diberi tanda **Baru**. Dokumen yang diperbarui setelah terakhir Anda baca diberi tanda **Diperbarui**.",
        ],
      },
      {
        q: "Bagaimana mencari aturan tertentu di dalam dokumen?",
        a: [
          "Ketik kata atau kalimat di kotak pencarian Perpustakaan, misalnya **cuti haid** atau **uang makan lembur**. Dengan pilihan **Judul & Isi** (bawaan), sistem mencari di judul sekaligus di **isi** semua dokumen.",
          "Hasilnya menampilkan cuplikan kalimat dengan kata yang dicari ditebalkan, beserta nomor halamannya (mis. **Hal. 12**). Klik cuplikan untuk membuka dokumen langsung di halaman tersebut. Di atas dokumen muncul daftar halaman lain yang juga cocok.",
          {
            list: [
              "Gunakan tanda kutip untuk frasa persis, mis. **\"pusat data\"**.",
              "Semua kata yang diketik harus ada di halaman yang sama.",
              "Pilih **Judul saja** bila hanya ingin mencari berdasarkan judul, nomor, atau ringkasan.",
            ],
          },
        ],
      },
      {
        q: "Kenapa isi sebuah dokumen tidak ditemukan saat dicari?",
        a: [
          "Dokumen hasil **scan** (foto/gambar halaman) baru bisa dicari isinya setelah dibaca dengan **OCR**. OCR berjalan otomatis di latar belakang; dokumen scan yang besar dijadwalkan malam hari, sehingga isinya baru bisa dicari keesokan harinya.",
          "Ada juga dokumen yang sengaja diunggah tanpa OCR. Dokumen seperti ini tetap bisa dibaca dan dicari berdasarkan judulnya. Hubungi HR bila aturan yang Anda cari ada di dokumen hasil scan.",
        ],
      },
      {
        q: "Dokumen terdiri dari beberapa bagian. Bagaimana membacanya?",
        a: [
          "Dokumen besar bisa dipecah menjadi beberapa file. Di Perpustakaan, semua bagian tampil sebagai **satu kartu** dengan tombol **Bagian 1**, **Bagian 2**, dan seterusnya. Hasil pencarian menyebut bagian dan halamannya, mis. **Bagian 2 · Hal. 15**.",
        ],
      },
      {
        q: "PDF tidak tampil di HP saya.",
        a: [
          "Beberapa browser HP tidak bisa menampilkan PDF di dalam halaman. Gunakan tombol **Tab Baru** atau **Unduh** di atas dokumen.",
        ],
      },
    ],
  },
  {
    id: "pinjam-mobil",
    title: "Pinjam Mobil Kantor",
    description: "Booking mobil dinas, sopir, dan pembatalan",
    icon: "vehicle",
    audience: "pegawai",
    link: { href: "/pegawai/kendaraan", label: "Buka Pinjam Mobil" },
    items: [
      {
        q: "Bagaimana cara booking mobil kantor?",
        a: [
          {
            steps: [
              "Buka **Pinjam Mobil**, lalu klik **Booking Mobil** (di HP, tombolnya ada di bagian bawah layar).",
              "Pilih tanggal serta jam mulai dan selesai. Tombol cepat **Pagi**, **Siang**, dan **Seharian** mengisi jam otomatis.",
              "Pilih mobil. Mobil yang kosong pada jam itu ditandai ✓; yang sudah dibooking tidak bisa dipilih.",
              "Isi tujuan, keperluan, dan jumlah penumpang. Aktifkan **Perlu sopir** jika Anda tidak menyetir sendiri.",
              "Klik tombol **Booking** di bagian bawah form. Petugas Kendaraan mendapat notifikasi untuk menyetujui.",
            ],
          },
          "Anda mendapat notifikasi saat booking disetujui atau ditolak. Statusnya juga terlihat di bagian **Booking Saya**.",
        ],
      },
      {
        q: "Bagaimana melihat mobil mana yang kosong?",
        a: [
          "Di bagian **Jadwal Mobil**, pilih tanggal (bisa digeser untuk 14 hari ke depan). Setiap mobil punya garis waktu pukul 06.00–22.00:",
          {
            table: {
              head: ["Tanda", "Arti"],
              rows: [
                ["Balok kuning", "Booking menunggu persetujuan (jam sudah dipesan)"],
                ["Balok biru", "Booking sudah disetujui"],
                ["Balok hijau", "Mobil sedang dipakai"],
                ["Garis merah", "Jam sekarang"],
              ],
            },
          },
          "Bagian yang kosong berarti mobil bisa dibooking pada jam itu.",
        ],
      },
      {
        q: "Mobil apa saja yang bisa saya booking?",
        a: [
          "Hanya mobil di **lokasi kerja Anda** yang berstatus Tersedia. Mobil yang sedang servis atau nonaktif tidak tampil. Jumlah penumpang dibatasi kapasitas mobil; jika meminta sopir, satu kursi dipakai sopir.",
        ],
      },
      {
        q: "Apa saja aturan booking?",
        a: [
          {
            list: [
              "Waktu mulai tidak boleh sudah lewat.",
              "Durasi paling lama **72 jam** per booking.",
              "Booking paling jauh **60 hari** ke depan.",
              "Satu mobil tidak bisa dibooking dua orang pada jam yang sama. Booking yang masih menunggu persetujuan pun sudah mengunci jamnya.",
            ],
          },
        ],
      },
      {
        q: "Saya minta sopir, tetapi disetujui tanpa sopir. Kenapa?",
        a: [
          "Jika semua sopir sedang bertugas, petugas dapat menyetujui booking dengan keterangan **Menyetir sendiri**. Keterangan ini tertulis di notifikasi persetujuan. Jika Anda tidak bisa menyetir, batalkan booking atau hubungi petugas.",
        ],
      },
      {
        q: "Bagaimana membatalkan booking?",
        a: [
          "Di **Booking Saya**, klik tanda **✕** pada booking yang masih **Menunggu** atau **Disetujui**, lalu konfirmasi. Jam tersebut langsung kosong lagi untuk pegawai lain. Booking yang sudah berjalan (kunci sudah diserahkan) tidak bisa dibatalkan.",
        ],
      },
      {
        q: "Bagaimana mengambil dan mengembalikan kunci?",
        a: [
          "Ambil kunci di **Petugas Kendaraan** sesuai jadwal. Petugas mencatat **KM awal** saat menyerahkan kunci. Saat mengembalikan, petugas mencatat **KM akhir** dan kondisi mobil (mis. sisa bensin atau kerusakan). Sampaikan kendala pada mobil kepada petugas saat serah-terima.",
          { note: "Kembalikan mobil tepat waktu. Mobil yang melewati jam selesai ditandai **Terlambat kembali** di layar petugas." },
        ],
      },
    ],
  },
  {
    id: "kendala",
    title: "Laporkan Kendala",
    description: "Melaporkan error atau masalah aplikasi",
    icon: "issue",
    audience: "pegawai",
    link: { href: "/pegawai/laporkan-kendala", label: "Buka Laporkan Kendala" },
    items: [
      {
        q: "Bagaimana cara melaporkan error?",
        a: [
          {
            steps: [
              "Buka **Laporkan Kendala** (menu paling bawah).",
              "Pilih kategori, tulis judul dan kronologi singkat: apa yang dilakukan, apa yang terjadi, dan apa yang seharusnya terjadi.",
              "Lampirkan **screenshot** bila ada (maksimal 3 gambar, masing-masing 3 MB).",
              "Kirim. Anda mendapat **nomor tiket** (mis. LK-2611-0001) untuk ditanyakan ke admin.",
            ],
          },
        ],
      },
      {
        q: "Apa arti status laporan?",
        a: [
          {
            table: {
              head: ["Status", "Arti"],
              rows: [
                ["Baru", "Belum ditinjau admin"],
                ["Diproses", "Sedang ditangani"],
                ["Selesai", "Sudah ditangani"],
                ["Ditolak", "Tidak ditindaklanjuti, alasan tertulis di tanggapan admin"],
              ],
            },
          },
          "Anda mendapat notifikasi setiap status berubah. Maksimal 5 laporan berstatus Baru per pegawai, jadi tunggu laporan sebelumnya ditinjau sebelum mengirim lagi.",
        ],
      },
    ],
  },

  // ─────────────────────────── PETUGAS & SOPIR ───────────────────────────
  {
    id: "petugas-kendaraan",
    title: "Petugas Kendaraan",
    description: "Menyetujui booking mobil dan serah-terima kunci",
    icon: "vehicleStaff",
    audience: "petugas",
    staffRole: "vehiclePetugas",
    link: { href: "/pegawai/kelola-kendaraan", label: "Buka Kelola Kendaraan" },
    items: [
      {
        q: "Apa tugas Petugas Kendaraan?",
        a: [
          "Petugas Kendaraan (biasanya bagian Umum) ditunjuk admin di menu Kendaraan Dinas. Petugas mendapat menu **Kelola Kendaraan** untuk:",
          {
            list: [
              "Menyetujui atau menolak booking pegawai.",
              "Menugaskan sopir, atau menetapkan pemohon menyetir sendiri.",
              "Mencatat serah-terima kunci beserta KM awal dan KM akhir.",
              "Membatalkan booking jika mobil mendadak dibutuhkan atau rusak.",
            ],
          },
          "Angka pada menu Kelola Kendaraan menunjukkan jumlah booking yang menunggu persetujuan. Notifikasi juga dikirim setiap ada booking baru.",
        ],
      },
      {
        q: "Bagaimana menyetujui booking?",
        a: [
          {
            steps: [
              "Buka tab **Perlu Persetujuan**, lalu klik **Setujui** pada booking.",
              "Ganti mobil bila perlu. Mobil yang bentrok pada jam itu tidak bisa dipilih.",
              "Pilih **Sopir**. Sopir yang sudah bertugas pada jam itu tidak bisa dipilih. Pilih **Menyetir sendiri** jika pemohon membawa mobil sendiri, termasuk saat semua sopir sedang bertugas.",
              "Tambahkan catatan bila perlu (mis. lokasi pengambilan kunci), lalu klik **Setujui**.",
            ],
          },
          "Pemohon dan sopir yang ditugaskan langsung mendapat notifikasi.",
          { note: "Jika pemohon meminta sopir, Anda wajib memilih salah satu sopir atau Menyetir sendiri. Menolak booking wajib disertai alasan." },
        ],
      },
      {
        q: "Bagaimana mencatat serah-terima kunci?",
        a: [
          {
            steps: [
              "Buka tab **Serah-Terima Hari Ini**.",
              "Saat pemohon mengambil kunci, klik **Serahkan Kunci** dan isi **KM awal** sesuai odometer. Kolom terisi otomatis dari KM terakhir mobil; periksa dan sesuaikan.",
              "Saat mobil kembali, klik **Terima Kembali**, isi **KM akhir**, dan catat kondisi mobil (bensin, kerusakan, kebersihan).",
            ],
          },
          "KM akhir tidak boleh lebih kecil dari KM awal, dan menjadi KM terakhir mobil untuk pemakaian berikutnya. Mobil yang belum kembali melewati jadwal ditandai **Terlambat kembali**.",
        ],
      },
      {
        q: "Mobil mendadak rusak atau dipakai Direksi. Bagaimana dengan booking yang sudah disetujui?",
        a: [
          "Klik **Batalkan** pada booking tersebut dan tuliskan alasannya; pemohon mendapat notifikasi. Jika mobil masuk bengkel, minta admin mengubah status mobil menjadi **Servis** di Kendaraan Dinas agar tidak bisa dibooking sementara.",
        ],
      },
    ],
  },
  {
    id: "sopir",
    title: "Tugas Sopir",
    description: "Melihat jadwal menyopir",
    icon: "driver",
    audience: "petugas",
    staffRole: "vehicleSopir",
    link: { href: "/pegawai/kendaraan", label: "Buka Pinjam Mobil" },
    items: [
      {
        q: "Di mana saya melihat jadwal menyopir?",
        a: [
          "Saat petugas menugaskan Anda, Anda mendapat notifikasi **Tugas Menyopir**. Semua tugas yang akan datang tampil di bagian **Tugas Menyopir** di halaman Pinjam Mobil, lengkap dengan waktu, mobil, pemohon, dan tujuan.",
        ],
      },
      {
        q: "Bisakah saya ditugaskan di dua booking yang jamnya bentrok?",
        a: [
          "Tidak. Sistem menolak penugasan sopir yang sudah bertugas pada jam yang sama, jadi jadwal Anda tidak akan tumpang-tindih.",
        ],
      },
      {
        q: "Saya berhalangan pada jadwal menyopir. Apa yang harus dilakukan?",
        a: [
          "Segera kabari **Petugas Kendaraan** agar menugaskan sopir lain atau mengatur ulang booking. Jika Anda tidak masuk kerja, tetap ajukan izin seperti biasa.",
        ],
      },
    ],
  },
  // ───────────────────────────── ADMIN HR ─────────────────────────────
  {
    id: "admin-pegawai",
    title: "Data Pegawai",
    description: "Tambah, impor, riwayat, dan dokumen pegawai",
    icon: "employees",
    audience: "admin",
    link: { href: "/admin/pegawai", label: "Buka Data Pegawai" },
    items: [
      {
        q: "Bagaimana cara menambah banyak pegawai sekaligus?",
        a: [
          {
            steps: [
              "Di Data Pegawai, klik **Import Pegawai**.",
              "Unduh template Excel dari jendela yang muncul, lalu isi sesuai petunjuk di template.",
              "Unggah kembali file tersebut. Baris yang tidak valid dilaporkan beserta alasannya, sedangkan baris yang valid tetap tersimpan.",
            ],
          },
        ],
      },
      {
        q: "Bagaimana mencetak CV pegawai beserta KTP, KK, dan sertifikatnya?",
        a: [
          {
            steps: [
              "Buka detail pegawai, lalu klik **Cetak PDF**.",
              "Centang isi yang dibutuhkan, baik bagian CV (profil, keluarga, riwayat, punishment, dan lainnya) maupun lampiran (KTP, KK, scan sertifikat, file riwayat). Tombol **Semua**, **CV saja**, dan **Lampiran saja** mempercepat pemilihan.",
              "Klik **Pratinjau** untuk membuka di tab baru atau **Unduh PDF** untuk menyimpannya.",
            ],
          },
          "Hasilnya satu file PDF: CV di halaman awal (lengkap dengan Daftar Lampiran dan nomor halamannya), lalu setiap lampiran utuh sesuai file aslinya. Lampiran berupa gambar dipasang satu halaman penuh tanpa terpotong.",
          { note: "Setiap halaman diberi watermark HRIS Bank Gresik beserta nama pengunduh dan waktu unduh. Setiap unduhan juga tercatat di Log Aktivitas." },
        ],
      },
      {
        q: "Bagaimana mengisi riwayat pekerjaan, mutasi, dan pelatihan untuk semua pegawai?",
        a: [
          "Gunakan **Import Riwayat** di Data Pegawai. Template berisi satu sheet per jenis riwayat, dan pegawai dicocokkan lewat NIP. Data yang persis sama dengan yang sudah ada dilewati agar tidak dobel.",
          { note: "Import hanya untuk data teks. File pendukung (SK, sertifikat) diunggah satu per satu di tab Riwayat pada detail pegawai." },
        ],
      },
      {
        q: "Apa yang terjadi pada file lama saat riwayat diubah atau dihapus?",
        a: [
          "Saat file pendukung diganti atau riwayatnya dihapus, **file lama ikut dihapus permanen** dari server untuk menghemat penyimpanan. Jendela konfirmasi selalu menampilkan peringatan ini sebelum disimpan.",
        ],
      },
      {
        q: "Bagaimana membuka Update Data Mandiri untuk pegawai?",
        a: [
          {
            steps: [
              "Di Data Pegawai, klik tombol di kolom **Update Mandiri** pada baris pegawai (**Aktifkan**, atau **Aktif (n)** jika sudah terbuka).",
              "Centang bagian yang boleh diubah: kontak, alamat, media sosial, data pribadi, pendidikan, rekening, pas foto, dan/atau dokumen (KTP/KK/NPWP).",
              "Simpan. Pegawai mendapat notifikasi beserta tautan ke halaman Update Data.",
            ],
          },
          "Untuk banyak pegawai sekaligus, centang barisnya di tabel (kotak di judul kolom memilih semua hasil pencarian), klik **Update Mandiri (n dipilih)** di atas tabel, lalu **Aktifkan untuk n pegawai**.",
          "Setelah pegawai menekan **Simpan & Selesai**, akses otomatis tertutup dan admin HR menerima notifikasi ringkasan perubahan. Jika rekening bank ikut diubah, judul notifikasi diberi tanda ⚠ agar diverifikasi.",
          { note: "Data kepegawaian (NIP, jabatan, status, gaji, dan sejenisnya) tidak pernah bisa diubah pegawai sendiri." },
        ],
      },
      {
        q: "Apa fungsi watermark di Pengaturan Kepegawaian?",
        a: [
          "Saat aktif, scan KTP/KK/NPWP/Surat Nikah yang dibuka diberi watermark berisi **nama pemilik, nama pembuka, dan waktunya**. Kalau tangkapan layarnya bocor, sumbernya bisa ditelusuri. Kalau watermark gagal dibuat, dokumen tidak ditampilkan sama sekali.",
        ],
      },
      {
        q: "Data master apa yang memengaruhi modul lain?",
        a: [
          {
            table: {
              head: ["Data", "Dipakai untuk"],
              rows: [
                ["Atasan langsung & kepala bagian", "Menentukan approver izin"],
                ["Jam & hari kerja", "Status terlambat/pulang cepat, deteksi mangkir"],
                ["Hari libur nasional", "Hitungan hari Cuti & Dispensasi"],
                ["Tarif tunjangan per jabatan", "Tunjangan Kehadiran di payroll"],
                ["Lokasi kerja (geofence)", "Penilaian posisi saat mengajukan izin"],
                ["PIN mesin absensi", "Menghubungkan tap fingerprint ke pegawai"],
                ["Status PTKP & NPWP", "Perhitungan PPh 21"],
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "admin-sertifikasi",
    title: "Sertifikasi & Pelatihan Wajib",
    description: "Kewajiban sertifikasi per jabatan, masa berlaku, dan pengingat",
    icon: "employees",
    audience: "admin",
    link: { href: "/admin/sertifikasi", label: "Buka Sertifikasi & Pelatihan" },
    items: [
      {
        q: "Bagaimana mulai memakai menu Sertifikasi & Pelatihan?",
        a: [
          {
            steps: [
              "Di tab **Jenis Sertifikasi**, tambahkan jenisnya, misalnya Sertifikasi Manajemen Risiko atau Pelatihan APU-PPT.",
              "Isi **masa berlaku** (dalam bulan) atau pilih berlaku selamanya, lalu tentukan **wajib untuk** semua pegawai atau jabatan tertentu.",
              "Di tab **Sertifikat Pegawai**, catat sertifikat yang sudah dimiliki pegawai beserta scan-nya. Tanggal kedaluwarsa terisi otomatis dari masa berlaku.",
              "Pantau tab **Kepatuhan** untuk melihat siapa yang belum punya, sudah kedaluwarsa, atau segera kedaluwarsa.",
            ],
          },
        ],
      },
      {
        q: "Kapan pegawai dianggap memenuhi kewajiban?",
        a: [
          "Kalau pegawai punya sertifikat jenis itu yang **masih berlaku**. Sertifikat yang masuk masa pengingat (**Segera Kedaluwarsa**) masih dihitung patuh, tetapi perlu disiapkan perpanjangannya.",
          "Kalau pegawai punya beberapa sertifikat sejenis (lama dan perpanjangan), yang dihitung adalah yang berlaku paling lama.",
        ],
      },
      {
        q: "Bagaimana pengingat kedaluwarsa dikirim?",
        a: [
          "Sistem memeriksa setiap 12 jam. Notifikasi dikirim **sekali per tahap**: saat masuk masa pengingat (bawaan 90 hari sebelumnya), 30 hari, 7 hari, dan pada hari kedaluwarsa.",
          "Pegawai menerima notifikasi untuk sertifikatnya sendiri. Super Admin dan HR Admin yang memegang menu ini menerima ringkasannya.",
          "Setelah sertifikat diperpanjang (tanggal kedaluwarsa diubah atau sertifikat baru dicatat), pengingat dimulai dari awal lagi.",
        ],
      },
      {
        q: "Bagaimana menyiapkan data untuk pemeriksaan OJK atau audit?",
        a: [
          "Klik **Unduh Rekap**. File Excel berisi tiga sheet: ringkasan kepatuhan per sertifikasi, kewajiban per pegawai beserta statusnya, dan daftar seluruh sertifikat.",
        ],
      },
      {
        q: "Apa beda menu ini dengan Riwayat Pelatihan di data pegawai?",
        a: [
          "Riwayat Pelatihan hanya catatan bebas (tanggal dan keterangan). Menu ini terstruktur: punya jenis, nomor sertifikat, masa berlaku, dan aturan wajib per jabatan, sehingga kepatuhannya bisa dihitung dan diingatkan otomatis.",
        ],
      },
    ],
  },
  {
    id: "admin-izin",
    title: "Pengaturan Izin & Alur Approval",
    description: "Mengatur approver, batas pengajuan, dan saldo cuti",
    icon: "leaveAdmin",
    audience: "admin",
    link: { href: "/admin/alur-approval", label: "Buka Alur Approval" },
    items: [
      {
        q: "Bagaimana cara mengatur siapa yang menyetujui tiap jenis izin?",
        a: [
          "Di **Alur Approval**, susun urutan tahap per jenis izin. Perubahan berlaku tanpa mengubah kode. Tipe approver yang bisa dipakai:",
          {
            list: [
              "**Atasan Langsung**: diambil dari atasan pemohon di data pegawai.",
              "**Kepala Departemen**: kepala bagian pemohon.",
              "**Direksi** / **Pegawai Tertentu**: pegawai yang Anda tunjuk. Pegawai Tertentu juga dipakai sebagai pemeriksa HR.",
              "**Pegawai Pengganti**: konfirmasi kesediaan, bukan persetujuan.",
            ],
          },
          { note: "Tipe HR belum berfungsi dan selalu dilewati. Gunakan Pegawai Tertentu untuk pemeriksaan HR. Pegawai Pengganti juga belum berlaku di Izin Lembur." },
        ],
      },
      {
        q: "Kenapa ada tahap yang terlewati otomatis?",
        a: [
          {
            list: [
              "Pejabat di tahap itu adalah pemohonnya sendiri.",
              "Approver-nya tidak bisa ditentukan, misalnya pegawai belum punya atasan di data pegawai.",
              "Tahap pemeriksaan HR pada Cuti 3 hari atau kurang.",
            ],
          },
          "Pastikan data atasan dan kepala bagian lengkap supaya alur berjalan sesuai rencana.",
        ],
      },
      {
        q: "Apa saja yang bisa diatur di Pengaturan Izin?",
        a: [
          {
            table: {
              head: ["Pengaturan", "Fungsi"],
              rows: [
                ["Aktif/Nonaktif", "Menutup jenis izin agar tidak bisa diajukan"],
                ["Batas Jam Pengajuan", "Izin harian ditolak bila diajukan lewat jam ini"],
                ["Batas per Bulan", "Membatasi jumlah pengajuan sebulan"],
                ["Mengurangi Tunjangan Kehadiran", "Menentukan pengaruh izin ke payroll"],
                ["Kop Surat Izin", "Banner di atas PDF cetak surat izin"],
                ["Auto-Tolak Lembur 24 Jam", "Saklar on/off (khusus Super Admin)"],
              ],
            },
          },
          { note: "Auto-tolak lembur membutuhkan jadwal cron di server yang memanggil /api/cron/reject-expired-overtime. Tanpa cron, saklar ini tidak berpengaruh." },
        ],
      },
      {
        q: "Bagaimana menyesuaikan saldo cuti pegawai?",
        a: [
          "Di **Saldo Cuti Pegawai**, isi kolom penyesuaian (tambah atau kurang) beserta alasannya. Kuota dasar tetap 12 hari. Penyesuaian tercatat sehingga bisa ditelusuri.",
        ],
      },
    ],
  },
  {
    id: "admin-payroll",
    title: "Payroll",
    description: "Alur proses, penguncian, dan koreksi",
    icon: "payroll",
    audience: "admin",
    link: { href: "/admin/payroll/proses", label: "Buka Proses Payroll" },
    items: [
      {
        q: "Bagaimana alur proses payroll sampai slip terbit?",
        a: [
          {
            steps: [
              "Susun payslip periode berstatus **Draft** (generate otomatis atau impor).",
              "Ajukan penguncian. Payroll diteruskan ke para penyetuju sesuai alur persetujuan payroll.",
              "Setelah seluruh tahap menyetujui, periode **Dikunci** dan slip otomatis terbit ke pegawai beserta notifikasinya.",
            ],
          },
        ],
      },
      {
        q: "Ada salah hitung setelah periode dikunci. Apa yang harus dilakukan?",
        a: [
          "Ajukan **koreksi** untuk membuka kembali periode itu. Koreksi juga melewati persetujuan. Setelah dikunci ulang, pegawai menerima notifikasi **Slip Gaji Diperbarui**.",
        ],
      },
      {
        q: "Apakah PPh 21 dari sistem bisa langsung dipakai untuk pelaporan resmi?",
        a: [
          "Perhitungan PPh 21 memakai beberapa penyederhanaan. Hasilnya wajar untuk slip gaji, tetapi **bukan pengganti perhitungan resmi**. Cocokkan dengan perhitungan pajak resmi sebelum pelaporan.",
        ],
      },
    ],
  },
  {
    id: "admin-klaim-kesehatan",
    title: "Klaim Kesehatan",
    description: "Pengaturan plafon, jenis klaim, petugas, dan Accounting",
    icon: "health",
    audience: "admin",
    link: { href: "/admin/payroll/klaim-kesehatan", label: "Buka Klaim Kesehatan" },
    items: [
      {
        q: "Apa yang perlu disiapkan sebelum pegawai bisa mengajukan klaim?",
        a: [
          "Buka **Klaim Kesehatan → Pengaturan**, lalu lengkapi:",
          {
            list: [
              "**Plafon per Jabatan** sesuai SK. Jabatan yang plafonnya kosong tidak bisa mengajukan klaim.",
              "**Status Berhak**: centang status kepegawaian yang boleh klaim (bawaan: Tetap dan Kontrak).",
              "**Petugas Klaim** yang memeriksa klaim, dan **Accounting** yang mencatat pembayaran.",
              "**Jenis Klaim** beserta bukti wajibnya.",
            ],
          },
          "Halaman Klaim Kesehatan menampilkan daftar periksa penyiapan sampai semuanya lengkap.",
        ],
      },
      {
        q: "Bagaimana alur klaim sampai dibayar?",
        a: [
          {
            steps: [
              "Pegawai mengajukan klaim beserta kuitansi.",
              "Petugas klaim memeriksa dan mengonfirmasi, dan boleh menyesuaikan nominal dengan alasan.",
              "Setelah terkumpul minimal 5 klaim terkonfirmasi, petugas membuat satu **Nota Dinas**.",
              "Nota Dinas disetujui pejabat terkait, lalu didisposisi Direktur.",
              "Accounting melihat Nota Dinas final di HRIS dan mencatat pembayaran.",
            ],
          },
        ],
      },
      {
        q: "Bagaimana mengatur periode reset plafon?",
        a: [
          "Di **Pengaturan → Umum**, pilih **Awal periode plafon**. Contoh Maret: periode berjalan Maret sampai Februari tahun berikutnya, dan sisa plafon direset setiap 1 Maret.",
          "Klaim masuk periode berdasarkan **tanggal berobat**. Bila pengaturan ini diubah, periode semua klaim yang sudah ada dihitung ulang otomatis sehingga sisa plafon dan rekap tetap konsisten.",
        ],
      },
      {
        q: "Bagaimana petugas memeriksa dan mengonfirmasi klaim?",
        a: [
          {
            steps: [
              "Buka menu **Pemeriksaan Klaim** (muncul otomatis bagi petugas yang ditunjuk), lalu klik nomor klaim yang menunggu konfirmasi.",
              "Periksa bukti (dibuka dengan watermark), data pasien, dan sisa plafon pegawai.",
              "Bila ada item di nota yang tidak bisa diklaim, ubah nominal disetujui pada baris itu dan tulis alasannya.",
              "Klik **Konfirmasi**, **Minta Revisi** (klaim dikembalikan ke pegawai), atau **Tolak**. Catatan revisi dan alasan penolakan wajib diisi.",
            ],
          },
          "Nominal disetujui otomatis dibatasi sisa plafon. Sisa plafon dihitung sesuai urutan pengajuan, jadi klaim yang diajukan belakangan tidak mengurangi plafon klaim yang lebih dulu.",
          { note: "Petugas cukup dicentang di Pengaturan → Petugas Klaim, tanpa perlu peran HR Admin atau akses dari Manajemen Akses HR. Super Admin juga bisa mengonfirmasi lewat menu admin Klaim Kesehatan. Petugas tidak bisa mengonfirmasi klaimnya sendiri." },
        ],
      },
      {
        q: "Bagaimana membuat Nota Dinas?",
        a: [
          {
            steps: [
              "Di menu **Pemeriksaan Klaim**, kartu **Antrean Nota Dinas** menunjukkan berapa pegawai yang klaimnya sudah terkonfirmasi.",
              "Setelah mencapai minimal 5 klaim, klik **Buat Nota Dinas**.",
              "Pilih klaim yang diajukan, sunting kolom Keterangan bila perlu (mis. \"Pembelian Obat-Obatan\"), periksa teks pembuka dan penutup, lalu klik **Buat & Ajukan Nota Dinas**.",
              "Semua klaim terkonfirmasi tercentang. Lepas centang klaim yang ingin ditunda; klaim itu ditandai **Masuk Nota Dinas berikutnya** dan tetap di antrean.",
            ],
          },
          "Nota Dinas langsung dikirim ke penyetuju pertama sesuai **Alur Persetujuan** di Pengaturan → Nota Dinas, lalu ke Direktur untuk disposisi. Kolom **Saldo Awal** dihitung otomatis dari sisa plafon tiap pegawai, dan total beserta terbilangnya diisi otomatis di teks pembuka.",
          { note: "PDF Nota Dinas bisa dilihat kapan saja. Sebelum disposisi disetujui, PDF diberi cap DRAF." },
        ],
      },
      {
        q: "Bagaimana sistem menghitung syarat minimal Nota Dinas?",
        a: [
          "Yang dihitung adalah **jumlah klaim**, bukan jumlah orang. Beberapa klaim dari pegawai yang sama dihitung masing-masing, sehingga bisa ikut menggenapi syarat minimal. Hanya klaim berstatus Terkonfirmasi yang belum masuk Nota Dinas yang dihitung. Contoh: 3 klaim dari 2 pegawai berarti \"3 dari 5 klaim\". Angka minimal bisa diubah di Pengaturan → Umum.",
          "Di daftar klaim, nomor Nota Dinas tampil di bawah status klaim yang sudah diajukan, sehingga terlihat siapa yang sudah masuk Nota Dinas.",
        ],
      },
      {
        q: "Apa yang terjadi bila Nota Dinas dikembalikan atau tidak disetujui?",
        a: [
          {
            table: {
              head: ["Keputusan", "Akibat"],
              rows: [
                ["Dikembalikan / Tinjau ulang", "Petugas bisa menyunting teks, mengeluarkan klaim, lalu Ajukan Ulang. Alur dimulai lagi dari langkah pertama"],
                ["Setuju / Setuju dengan catatan", "Nota Dinas disetujui, klaim di dalamnya menunggu pembayaran"],
                ["Tidak disetujui", "Seluruh klaim di Nota Dinas itu ditolak dan plafonnya dikembalikan"],
              ],
            },
          },
          "Penyetuju yang diizinkan di Pengaturan juga bisa menurunkan nominal klaim atau mengeluarkan klaim tertentu. Klaim yang dikeluarkan kembali ke antrean untuk Nota Dinas berikutnya.",
        ],
      },
      {
        q: "Di mana penyetuju dan Direktur memproses Nota Dinas?",
        a: [
          "Di **Approval Center**, bersama antrean izin. Klik **Tinjau & Putuskan** untuk membuka Nota Dinas, melihat PDF-nya, lalu menyetujui atau memberi disposisi. Penyetuju tidak perlu akses menu admin.",
        ],
      },
      {
        q: "Bagaimana Accounting mencatat pembayaran?",
        a: [
          "Pegawai yang ditunjuk sebagai **Accounting** di Pengaturan otomatis mendapat menu **Pembayaran Klaim** dan notifikasi setiap ada Nota Dinas yang selesai didisposisi. Nota Dinas final (lengkap dengan tanda tangan dan disposisi) bisa dilihat langsung di sana, tanpa perlu dicetak petugas.",
          {
            steps: [
              "Buka Nota Dinas di tab **Siap Dibayar**.",
              "Lakukan transfer di CBS ke rekening tiap pegawai.",
              "Centang pegawai yang sudah ditransfer, isi **tanggal transfer** dan **Nomor Jurnal CBS**, periksa rekening tujuan, lalu klik **Catat Transfer**.",
              "Bila perlu, unggah bukti transfer atau cetakan jurnal di **Bukti Pembayaran**.",
            ],
          },
          "Pegawai yang belum ditransfer bisa dicatat belakangan, dan selama itu Nota Dinas berstatus **Dibayar Sebagian**. Setelah semua tercatat, statusnya menjadi **Dibayar**, dan pegawai serta petugas menerima notifikasi.",
          { note: "Pembayaran yang salah catat hanya bisa dibatalkan Super Admin, dengan alasan." },
        ],
      },
      {
        q: "Di mana melihat sisa plafon seluruh pegawai?",
        a: [
          "Di **Klaim Kesehatan → Rekap Plafon**. Halaman ini menampilkan plafon, terpakai, sedang diproses, dan sisa per pegawai per tahun. Tombol **Unduh Excel** menghasilkan dua sheet: rekap per pegawai dan rincian semua klaim tahun itu (termasuk nomor Nota Dinas, disposisi, dan tanggal bayar). Accounting juga bisa mengunduhnya dari menu Pembayaran Klaim.",
        ],
      },
      {
        q: "Bagaimana memastikan cetakan Nota Dinas asli?",
        a: [
          "Nota Dinas yang sudah disetujui Direksi memiliki **kode QR** di bawah kotak disposisi. Pindai QR tersebut (dalam keadaan login HRIS) untuk membuka halaman verifikasi yang menampilkan nomor, total, jumlah klaim, dan siapa saja yang menyetujui.",
        ],
      },
      {
        q: "Di mana rekening bank pegawai diisi?",
        a: [
          "Di **Data Pegawai → Edit**, bagian **Rekening Bank**, atau lewat kolom Nama Bank, Nomor Rekening, dan Atas Nama Rekening di template **Import Pegawai**. Rekening dipakai sebagai tujuan transfer pembayaran klaim; bila masih kosong, Accounting bisa mengisinya saat mencatat transfer dan menyimpannya ke data pegawai.",
        ],
      },
    ],
  },
  {
    id: "admin-perpustakaan",
    title: "Kelola Perpustakaan",
    description: "Mengunggah dokumen dan memantau pembaca",
    icon: "library",
    audience: "admin",
    link: { href: "/admin/perpustakaan", label: "Buka Kelola Perpustakaan" },
    items: [
      {
        q: "Bagaimana menambah dokumen ke Perpustakaan?",
        a: [
          {
            steps: [
              "Buka **Kelola Perpustakaan**, klik **Tambah Dokumen**.",
              "Isi judul, kategori, nomor dokumen, dan tanggal berlaku, lalu pilih file **PDF (maksimal 10 MB)**.",
              "Biarkan **Terbitkan** tercentang agar langsung terlihat pegawai, atau hapus centangnya untuk menyimpan sebagai draf.",
              "Centang **Kirim notifikasi** bila semua pegawai perlu segera membaca.",
            ],
          },
          "HR Admin baru bisa membuka menu ini setelah diberi akses **Kelola Perpustakaan** oleh Super Admin.",
        ],
      },
      {
        q: "Bagaimana mengetahui siapa yang belum membaca?",
        a: [
          "Klik angka **Dibaca N/M** pada dokumen. Daftar terbagi menjadi **Belum Membaca** dan **Sudah Membaca**, lengkap dengan bagian dan waktu terakhir dibuka.",
          "Membuka dokumen berkali-kali dalam 30 menit dihitung satu kali.",
        ],
      },
      {
        q: "Ada versi baru sebuah peraturan. Unggah ulang atau ganti?",
        a: [
          "Kalau menggantikan versi lama, buka **Ubah** lalu pilih PDF baru. File lama dihapus permanen setelah disimpan, dan pegawai yang sudah membaca versi lama melihat tanda **Diperbarui**.",
          "Kalau versi lama masih perlu disimpan sebagai rujukan, tambahkan sebagai dokumen baru.",
        ],
      },
      {
        q: "Apa arti status teks di bawah setiap dokumen?",
        a: [
          "Status menunjukkan apakah isi dokumen sudah bisa dicari pegawai:",
          {
            table: {
              head: ["Status", "Arti"],
              rows: [
                ["Isi bisa dicari", "Seluruh halaman punya teks dan terindeks"],
                ["Tanpa OCR", "Ada halaman scan yang isinya tidak ikut dicari (jumlahnya tertulis, mis. 12 hlm scan)"],
                ["Menunggu dibaca", "Dokumen lama yang sedang diantrekan; dibaca otomatis dalam beberapa menit"],
                ["Gagal dibaca", "File rusak atau dilindungi password"],
              ],
            },
          },
          "Klik status untuk melihat teks per halaman yang dipakai pencarian, lalu klik **Baca Ulang** bila perlu.",
        ],
      },
      {
        q: "Apa yang diperiksa saat saya memilih file PDF?",
        a: [
          "Begitu file dipilih, sistem menghitung jumlah halaman dan **halaman scan** (halaman tanpa teks), lalu menampilkannya sebelum Anda menyimpan.",
          {
            list: [
              "File melebihi batas total halaman (bawaan **1.000 halaman**) ditolak. Pecah menjadi beberapa bagian.",
              "Halaman scan melebihi batas OCR (bawaan **300**): toggle OCR terkunci, dan sistem menyarankan jumlah bagian serta rentang halamannya. Dokumen tetap bisa disimpan tanpa OCR.",
              "Toggle **Baca teks hasil scan (OCR)** bisa dimatikan bila isi dokumen tidak perlu dicari, karena OCR memberatkan server.",
            ],
          },
          { note: "Agar dokumen scan bisa dicari tanpa membebani server, simpan hasil scan sebagai **PDF yang bisa dicari (searchable PDF)** dari aplikasi scanner sebelum diunggah. Dokumen seperti itu tidak perlu OCR sama sekali." },
        ],
      },
      {
        q: "Bagaimana OCR berjalan, dan kapan isi dokumen scan bisa dicari?",
        a: [
          "OCR berjalan di latar belakang, **satu dokumen dan satu halaman dalam satu waktu** dengan prioritas terendah, supaya server tetap ringan. Rata-rata 2–6 detik per halaman.",
          {
            table: {
              head: ["Halaman scan", "Kapan di-OCR"],
              rows: [
                ["1–20", "Langsung setelah disimpan"],
                ["21–50", "Langsung, menunggu giliran bila ada dokumen lain yang sedang di-OCR"],
                ["51–300", "Malam hari (bawaan 18.00–06.00), status *OCR dijadwalkan malam*"],
                ["> 300", "Tidak di-OCR; pecah file menjadi beberapa bagian"],
              ],
            },
          },
          "Progresnya terlihat di label status, mis. **OCR 12/35 hlm**. Setelah selesai, klik label untuk melihat hasilnya per halaman beserta tingkat keyakinan OCR. Halaman dengan keyakinan di bawah 60% diberi peringatan; ganti file dengan scan yang lebih jelas (300 dpi, tidak miring) bila perlu.",
          "Dokumen yang diunggah tanpa OCR, atau yang sebagian halamannya gagal, bisa di-OCR belakangan lewat tombol **Jalankan OCR** di dialog teks dokumen.",
        ],
      },
      {
        q: "Bagaimana mengunggah dokumen yang dipecah menjadi beberapa bagian?",
        a: [
          {
            steps: [
              "Unggah bagian pertama seperti biasa. Ini menjadi **Bagian 1** dan menentukan judul, kategori, nomor, tanggal berlaku, serta status terbit.",
              "Klik **Tambah Dokumen**, aktifkan **Bagian lanjutan dari dokumen lain**, pilih dokumen Bagian 1, dan isi nomor bagian (2, 3, …).",
              "Pilih file bagian tersebut lalu simpan.",
            ],
          },
          "Perubahan judul atau status terbit pada Bagian 1 otomatis berlaku untuk semua bagian. Menghapus Bagian 1 ikut menghapus bagian lainnya.",
        ],
      },
      {
        q: "Siapa yang mengatur batas halaman dan OCR?",
        a: [
          "Super Admin, lewat tombol **Pengaturan** di halaman Kelola Perpustakaan: OCR aktif/nonaktif, batas OCR langsung (bawaan 20 dan 50 halaman scan), maksimal halaman scan (300), maksimal total halaman (1.000), jam malam (18.00–06.00), dan batas waktu per halaman. Setiap perubahan tercatat di Log Aktivitas.",
        ],
      },
    ],
  },

  {
    id: "admin-kendaraan",
    title: "Kendaraan Dinas",
    description: "Data mobil, petugas & sopir, dan seluruh booking",
    icon: "vehicle",
    audience: "admin",
    link: { href: "/admin/kendaraan", label: "Buka Kendaraan Dinas" },
    items: [
      {
        q: "Apa yang perlu disiapkan agar pegawai bisa booking mobil?",
        a: [
          {
            steps: [
              "Buka **Kendaraan Dinas**, tab **Kendaraan**, lalu tambahkan mobil: nama, plat nomor, kapasitas, lokasi kerja, dan foto (opsional).",
              "Di tab **Petugas & Sopir**, tunjuk minimal satu **Petugas** (yang menyetujui booking) dan, bila ada, **Sopir**.",
              "Pegawai di lokasi tersebut langsung bisa booking lewat menu **Pinjam Mobil**.",
            ],
          },
          { note: "Pegawai hanya melihat mobil di lokasi kerjanya sendiri. Pastikan lokasi kerja mobil dan pegawai sudah benar." },
        ],
      },
      {
        q: "Apa arti status mobil?",
        a: [
          {
            table: {
              head: ["Status", "Arti"],
              rows: [
                ["Tersedia", "Bisa dibooking pegawai"],
                ["Servis", "Sementara di bengkel; tidak tampil di pilihan booking"],
                ["Nonaktif", "Tidak dipakai lagi (dijual atau dipindahkan)"],
              ],
            },
          },
          "Mengubah status tidak membatalkan booking yang sudah ada. Minta petugas membatalkan booking yang terdampak.",
        ],
      },
      {
        q: "Kenapa mobil tidak bisa dihapus?",
        a: [
          "Mobil yang sudah pernah dibooking tidak bisa dihapus agar riwayat pemakaian dan KM tetap utuh. Ubah statusnya menjadi **Nonaktif**.",
        ],
      },
      {
        q: "Apakah Petugas Kendaraan harus punya akun admin?",
        a: [
          "Tidak. Cukup tunjuk pegawai sebagai Petugas di tab **Petugas & Sopir**; menu **Kelola Kendaraan** otomatis muncul di akun pegawainya.",
          "Agar Admin HR bisa membuka menu Kendaraan Dinas (data mobil dan penunjukan petugas), Super Admin mencentang **Umum → Kendaraan Dinas** di Manajemen Akses HR.",
        ],
      },
    ],
  },
  // ─────────────────────────── SUPER ADMIN ───────────────────────────
  {
    id: "sa-akses",
    title: "Manajemen Akses HR",
    description: "Memberi HR Admin akses per sub-menu",
    icon: "access",
    audience: "superadmin",
    link: { href: "/admin/akses-hr", label: "Buka Manajemen Akses HR" },
    items: [
      {
        q: "Bagaimana akses HR Admin bekerja?",
        a: [
          "Akses diberikan **per sub-menu**, misalnya hanya Data Absensi tanpa Pengaturan Absensi. Grup menu baru muncul di sidebar bila minimal satu isinya diberikan. Membuka alamat halaman secara langsung juga diblokir kalau aksesnya tidak diberikan.",
          "Menu khusus Super Admin (Manajemen Akses HR, Monitoring System, Manajemen Pengguna, Backup) tidak pernah bisa diberikan ke HR Admin.",
        ],
      },
      {
        q: "Kapan perubahan akses berlaku?",
        a: ["Langsung, pada halaman berikutnya yang dibuka HR Admin tersebut. Tidak perlu keluar dan masuk lagi."],
      },
    ],
  },
  {
    id: "sa-pengguna",
    title: "Manajemen Pengguna & Keamanan",
    description: "Akun terkunci, IP diblokir, reset kata sandi, 2FA",
    icon: "users",
    audience: "superadmin",
    link: { href: "/admin/manajemen-pengguna", label: "Buka Manajemen Pengguna" },
    items: [
      {
        q: "Pegawai tidak bisa login karena akunnya terkunci.",
        a: [
          "Akun terkunci setelah **5 kali salah kata sandi** dan tidak terbuka otomatis. Buka di **Manajemen Pengguna**. Kalau pegawai lupa kata sandinya, sekalian atur ulang kata sandinya.",
        ],
      },
      {
        q: "Apa itu daftar IP yang diblokir?",
        a: [
          "Alamat IP yang berulang kali gagal login harus menunggu bertahap (30 detik, 2 menit, 5 menit), lalu **diblokir permanen**. Ini menahan percobaan menebak kata sandi. Kalau yang terblokir adalah jaringan kantor sendiri, buka blokirnya di Manajemen Pengguna.",
        ],
      },
      {
        q: "Kenapa Super Admin wajib memakai 2FA?",
        a: [
          "Akun Super Admin memegang seluruh data, termasuk backup dan hak akses. Super Admin yang belum mengaktifkan autentikasi dua langkah (aplikasi authenticator) selalu diarahkan ke halaman pengaturan 2FA sampai selesai.",
        ],
      },
      {
        q: "Bagaimana mengatur logout otomatis dan masa berlaku kata sandi?",
        a: [
          "Buka **Kebijakan Keamanan**. Di halaman ini ada dua pengaturan:",
          {
            table: {
              head: ["Pengaturan", "Keterangan"],
              rows: [
                ["Logout otomatis", "Lama tidak aktif sebelum logout (5–120 menit, standar 15) dan lama hitung mundur peringatan"],
                ["Masa berlaku kata sandi", "Interval wajib ganti (atau tidak diberlakukan), jumlah hari peringatan, dan jumlah kata sandi terakhir yang tidak boleh dipakai ulang"],
              ],
            },
          },
          "Perubahan berlaku untuk semua pengguna dalam sekitar satu menit dan tercatat di Log Aktivitas. Logout karena tidak aktif tercatat sebagai **Logout Otomatis**.",
        ],
      },
      {
        q: "Apa yang terjadi setelah kata sandi pegawai direset?",
        a: [
          "Pegawai otomatis keluar dari semua perangkat, dan saat login berikutnya **wajib mengganti** kata sandi sementara sebelum bisa membuka menu lain. Akun yang baru dibuat juga wajib ganti kata sandi pada login pertama.",
        ],
      },
      {
        q: "Pegawai melaporkan \"Ini bukan saya\" pada aktivitas login. Apa tindak lanjutnya?",
        a: [
          "Laporan masuk sebagai **Laporan Kendala** kategori Akun, dan Super Admin mendapat notifikasi. Periksa waktu, perangkat, dan IP di laporan tersebut, lalu:",
          {
            list: [
              "Reset kata sandi pegawai; semua sesi aktifnya otomatis berakhir.",
              "Blokir IP di Manajemen Pengguna jika terlihat percobaan dari luar.",
              "Tutup laporan setelah selesai ditangani.",
            ],
          },
        ],
      },
      {
        q: "Bagaimana menonaktifkan akun pegawai yang resign?",
        a: [
          "Nonaktifkan akunnya di Manajemen Pengguna agar tidak bisa login lagi. Data pegawai dan riwayatnya tetap tersimpan.",
        ],
      },
    ],
  },
  {
    id: "sa-monitoring",
    title: "Monitoring Dashboard",
    description: "Kesehatan database, hak akses, request, dan scan malware",
    icon: "monitoring",
    audience: "superadmin",
    link: { href: "/admin/monitoring-system/dashboard", label: "Buka Monitoring Dashboard" },
    items: [
      {
        q: "Apa saja yang ditampilkan Monitoring Dashboard?",
        a: [
          {
            table: {
              head: ["Bagian", "Isi"],
              rows: [
                ["Koneksi Database", "Status koneksi, waktu respons, versi server, dan ukuran database"],
                ["Hak Akses", "Akun per peran, 2FA Super Admin, akun terkunci, IP yang diblokir"],
                ["Aktivitas Request (24 Jam)", "Grafik aktivitas per jam dan aksi yang paling sering"],
                ["Scanner File Upload", "Memeriksa file unggahan yang mencurigakan"],
              ],
            },
          },
        ],
      },
      {
        q: "Apa yang diperiksa Scanner File Upload?",
        a: [
          "Scanner memeriksa folder unggahan (foto, lampiran, dokumen pegawai) untuk:",
          {
            list: [
              "Ekstensi berbahaya (mis. .php, .exe, .js) atau ekstensi ganda seperti foto.jpg.php.",
              "Isi file yang tidak sesuai ekstensinya, misalnya \"gambar\" yang ternyata skrip.",
              "Potongan kode berbahaya seperti web shell.",
              "File yang tidak bisa dibaca. Ini sering berarti file sedang dikunci antivirus karena terdeteksi berbahaya.",
            ],
          },
          { note: "Scanner ini pemeriksa tambahan, bukan pengganti antivirus di server. Temuan kritis sebaiknya diperiksa dan dihapus manual oleh tim IT." },
        ],
      },
      {
        q: "Koneksi database berstatus lambat atau gagal. Apa yang harus dilakukan?",
        a: [
          "Periksa apakah layanan database (MariaDB/MySQL) di server masih berjalan dan ruang disk server masih cukup. Disk yang penuh juga membuat aplikasi gagal menyimpan data.",
        ],
      },
    ],
  },
  {
    id: "sa-penyimpanan",
    title: "Monitoring Penyimpanan & Log",
    description: "Ukuran data, ruang disk, Log Aktivitas, Laporan Kendala",
    icon: "storage",
    audience: "superadmin",
    link: { href: "/admin/monitoring-system/penyimpanan", label: "Buka Monitoring Penyimpanan" },
    items: [
      {
        q: "Apa yang ditampilkan Monitoring Penyimpanan?",
        a: [
          {
            list: [
              "**Ukuran data per modul**: tabel database dikelompokkan sesuai modul backup.",
              "**Penyimpanan file**: ukuran folder unggahan, dokumen pegawai, backup, dan arsip.",
              "**Ruang disk** server yang tersisa.",
              "**Tren pertumbuhan 30 hari**: dicatat otomatis setiap hari.",
            ],
          },
          "Kalau ruang disk menipis, hapus backup lama, arsipkan log lama lewat **Arsip Data**, atau tambah kapasitas disk.",
        ],
      },
      {
        q: "Apa yang dicatat di Log Aktivitas?",
        a: [
          "Login (berhasil maupun gagal), logout, tambah/ubah/hapus data, unduhan dokumen sensitif, perubahan hak akses, scan keamanan, backup, dan arsip. Setiap entri mencatat pelaku, waktu, alamat IP, dan perangkat.",
          "Log lama bisa dipindahkan ke file arsip lewat **Arsip Data** supaya database tetap ringan.",
        ],
      },
      {
        q: "Bagaimana menindaklanjuti Laporan Kendala dari pegawai?",
        a: [
          "Buka **Monitoring System → Laporan Kendala**, tinjau laporan dan screenshot-nya, lalu ubah status menjadi Diproses, Selesai, atau Ditolak. Penolakan wajib disertai tanggapan. Pelapor otomatis mendapat notifikasi setiap perubahan.",
        ],
      },
    ],
  },
  {
    id: "sa-backup",
    title: "Backup Database",
    description: "Membuat, menyimpan, dan memulihkan backup",
    icon: "backup",
    audience: "superadmin",
    link: { href: "/admin/backup/database", label: "Buka Backup Database" },
    items: [
      {
        q: "Bagaimana cara membuat backup?",
        a: [
          {
            steps: [
              "Buka **Backup Database → Backup Sekarang**.",
              "Pilih cakupan: **Seluruh Database**, atau per modul (Kepegawaian, Absensi, Payroll, Izin & Approval, Sistem & Log).",
              "Tunggu sampai selesai, lalu unduh filenya (.sql) dari tab **Riwayat**.",
            ],
          },
          "Untuk cadangan lengkap, pilih **Seluruh Database**. Backup per modul berguna untuk ekspor sebagian data.",
        ],
      },
      {
        q: "Apakah backup mencakup foto dan dokumen yang diunggah?",
        a: [
          "**Tidak.** Backup hanya berisi isi database. File berikut tidak ikut dan perlu disalin terpisah (mis. ke drive eksternal atau NAS):",
          {
            list: [
              "public/uploads: foto, tanda tangan, lampiran izin, screenshot laporan kendala, dan file riwayat pegawai.",
              "storage/dokumen-pegawai: scan KTP, KK, NPWP, akta.",
              "storage/perpustakaan: PDF Perpustakaan.",
              "storage/archives: file Arsip Data.",
            ],
          },
        ],
      },
      {
        q: "Apa fungsi Pengaturan Backup?",
        a: [
          {
            list: [
              "**Lokasi mysqldump.exe**: program yang dipakai membuat backup, di folder instalasi MySQL/MariaDB server (mis. XAMPP atau Laragon).",
              "**Retensi (hari)**: backup yang lebih tua dari jumlah hari ini dihapus otomatis dari server. Pemeriksaan berjalan setiap 6 jam.",
            ],
          },
          { note: "Retensi menghapus backup dari server. Unduh dan simpan backup penting di tempat lain sebelum melewati masa retensi." },
        ],
      },
      {
        q: "Bagaimana memulihkan (restore) database dari backup?",
        a: [
          "Pemulihan **tidak dilakukan dari dalam aplikasi**, karena menimpa seluruh data yang sedang berjalan. Serahkan file .sql ke tim IT untuk diimpor ke database lewat MySQL/MariaDB (mis. perintah mysql atau HeidiSQL), sebaiknya diuji dulu di database terpisah.",
        ],
      },
    ],
  },
  {
    id: "sa-arsip",
    title: "Arsip Data",
    description: "Memindahkan data lama keluar dari database",
    icon: "archive",
    audience: "superadmin",
    link: { href: "/admin/backup/arsip", label: "Buka Arsip Data" },
    items: [
      {
        q: "Apa beda Arsip Data dengan Backup?",
        a: [
          "**Backup menyalin** data, sedangkan data aslinya tetap ada. **Arsip memindahkan** data lama ke file terkompresi lalu **menghapusnya dari database**, sehingga database lebih ringan.",
          "Data yang bisa diarsipkan: **Log Absensi fingerprint**, **Log Aktivitas**, dan **Notifikasi yang sudah dibaca**.",
        ],
      },
      {
        q: "Apa arti pilihan \"> 3 bln\", \"> 12 bln\", dan seterusnya?",
        a: [
          "Yang diarsipkan adalah data yang **lebih tua dari** batas itu. Pilihan \"> 3 bln\" mengarsipkan paling banyak data (semua yang lebih tua dari 3 bulan), sedangkan \"> 24 bln\" paling sedikit (hanya yang sangat lama).",
        ],
      },
      {
        q: "Apakah proses arsip aman?",
        a: [
          {
            list: [
              "File arsip dibaca ulang dan dicocokkan dulu. Data baru dihapus dari database kalau isinya sudah terverifikasi sama persis.",
              "Konfirmasi dengan mengetik **HAPUS** diperlukan sebelum berjalan.",
              "Data arsip bisa **dipulihkan** kapan saja, baik dari file yang tersimpan di server maupun dari file yang diunggah ulang. Data digabungkan tanpa menduplikasi yang sudah ada.",
            ],
          },
          { note: "Unduh file arsip dan simpan di tempat lain. Kalau file di server dihapus dan tidak ada salinannya, data tersebut hilang permanen." },
        ],
      },
    ],
  },
]

export const FAQ_AUDIENCE_LABEL: Record<FaqAudience, string> = {
  pegawai: "Pegawai",
  petugas: "Petugas & Sopir",
  admin: "Admin HR",
  superadmin: "Super Admin",
}

export function faqTopicsFor(
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE",
  staffRoles: FaqStaffRole[] = []
): FaqTopic[] {
  if (role === "SUPER_ADMIN") return FAQ_TOPICS
  if (role === "HR_ADMIN") return FAQ_TOPICS.filter((t) => t.audience !== "superadmin")
  return FAQ_TOPICS.filter(
    (t) => t.audience === "pegawai" || (t.audience === "petugas" && !!t.staffRole && staffRoles.includes(t.staffRole))
  )
}
