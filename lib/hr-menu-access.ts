// Menu admin yang bisa dibuka/tutup per akun HR Admin (lihat Manajemen Akses
// HR), granularitasnya PER SUB-MENU (bukan per-grup lagi) — Super Admin bisa
// mencentang sebagian isi grup, mis. cuma "Data Absensi" tanpa "Pengaturan
// Absensi". SUPER_ADMIN, menu "Pengaturan Akun" (isinya cuma ubah username/password
// akun sendiri — lihat app/admin/pengaturan), "Approval Center" (wajib buat
// semua akun yang punya identitas pegawai — approver perlu ini buat proses
// pengajuan izin/cuti timnya sendiri), dan menu khusus SUPER_ADMIN (Manajemen
// Akses HR, Log Aktivitas, Manajemen Pengguna) tidak pernah lewat mekanisme
// ini.
export const HR_MENU_GROUPS = [
  {
    key: "kepegawaian",
    label: "Kepegawaian",
    items: [
      { key: "kepegawaian.pegawai", label: "Data Pegawai" },
      { key: "kepegawaian.struktur-organisasi", label: "Struktur Organisasi" },
      { key: "kepegawaian.jabatan", label: "Data Jabatan" },
      { key: "kepegawaian.bagian", label: "Data Bagian" },
      { key: "kepegawaian.lokasi-kerja", label: "Data Lokasi Kerja" },
      { key: "kepegawaian.jam-kerja", label: "Data Hari & Jam Kerja" },
      { key: "kepegawaian.hari-libur", label: "Hari Libur Nasional" },
      { key: "kepegawaian.saldo-cuti", label: "Saldo Cuti Pegawai" },
      { key: "kepegawaian.pengaturan", label: "Pengaturan Kepegawaian" },
    ],
  },
  {
    key: "payroll",
    label: "Payroll",
    items: [
      { key: "payroll.komponen-gaji", label: "Komponen Gaji" },
      { key: "payroll.struktur-gaji", label: "Struktur & Golongan Gaji" },
      { key: "payroll.proses", label: "Proses Payroll" },
      { key: "payroll.slip-gaji", label: "Slip Gaji Pegawai" },
      { key: "payroll.pajak-bpjs", label: "BPJS & Pajak (PPh 21)" },
      { key: "payroll.klaim-kesehatan", label: "Klaim Kesehatan" },
      { key: "payroll.pengaturan", label: "Pengaturan Payroll" },
    ],
  },
  {
    key: "absensi",
    label: "Absensi",
    items: [
      { key: "absensi.data", label: "Data Absensi" },
      { key: "absensi.pengaturan", label: "Pengaturan Absensi" },
    ],
  },
  {
    key: "approval",
    label: "Izin",
    items: [
      { key: "approval.monitoring", label: "Monitoring Izin" },
      { key: "approval.alur", label: "Alur Approval" },
      { key: "approval.pengaturan", label: "Pengaturan Izin" },
    ],
  },
  {
    key: "laporan",
    label: "Laporan",
    // Grup ini cuma satu link datar (tidak ada sub-halaman) — tetap
    // direpresentasikan sebagai "grup" satu item supaya bentuk datanya
    // seragam dengan grup lain (mempermudah render dialog/sidebar).
    items: [{ key: "laporan", label: "Laporan" }],
  },
] as const

export type HrMenuKey = (typeof HR_MENU_GROUPS)[number]["items"][number]["key"]

const HR_MENU_KEY_SET = new Set<string>(
  HR_MENU_GROUPS.flatMap((g) => g.items.map((i) => i.key))
)

// Key grup LAMA (sebelum granularitas per sub-menu) → daftar key sub-menu
// barunya. Dipakai parseMenuAccess buat menerjemahkan data lama secara
// otomatis, supaya akun HR Admin yang sudah dikonfigurasi sebelumnya
// (menuAccess isinya cuma ["kepegawaian", "approval"], dst.) tidak diam-diam
// kehilangan semua akses begitu granularitasnya berubah — dibaca sekali,
// otomatis "meluas" jadi akses ke semua sub-menu grup itu.
const LEGACY_GROUP_EXPANSION: Record<string, HrMenuKey[]> = Object.fromEntries(
  HR_MENU_GROUPS.map((g) => [g.key, g.items.map((i) => i.key)])
)

// Prefix path /admin/** yang dijaga oleh masing-masing SUB-MENU — dipakai di
// proxy.ts (middleware) buat blokir akses langsung lewat URL kalau HR Admin
// yang bersangkutan belum diberi akses ke sub-menu itu. Urutan penting kalau
// ada prefix yang saling menaungi (paling spesifik duluan) — lihat pasangan
// /admin/pegawai/pengaturan vs /admin/pegawai di bawah, satu-satunya kasus
// begitu saat ini.
export const HR_MENU_PATH_PREFIXES: [string, HrMenuKey][] = [
  // WAJIB di atas "/admin/pegawai" — pencocokannya startsWith + ambil yang
  // pertama cocok, jadi kalau urutannya dibalik, halaman pengaturan ini akan
  // dijaga oleh kunci "kepegawaian.pegawai" (akses Data Pegawai), bukan
  // kuncinya sendiri.
  ["/admin/pegawai/pengaturan", "kepegawaian.pengaturan"],
  ["/admin/pegawai", "kepegawaian.pegawai"],
  ["/admin/struktur-organisasi", "kepegawaian.struktur-organisasi"],
  ["/admin/jabatan", "kepegawaian.jabatan"],
  ["/admin/bagian", "kepegawaian.bagian"],
  ["/admin/lokasi-kerja", "kepegawaian.lokasi-kerja"],
  ["/admin/jam-kerja", "kepegawaian.jam-kerja"],
  ["/admin/hari-libur", "kepegawaian.hari-libur"],
  ["/admin/saldo-cuti", "kepegawaian.saldo-cuti"],
  ["/admin/payroll/komponen-gaji", "payroll.komponen-gaji"],
  ["/admin/payroll/struktur-gaji", "payroll.struktur-gaji"],
  ["/admin/payroll/proses", "payroll.proses"],
  ["/admin/payroll/slip-gaji", "payroll.slip-gaji"],
  ["/admin/payroll/pajak-bpjs", "payroll.pajak-bpjs"],
  ["/admin/payroll/klaim-kesehatan", "payroll.klaim-kesehatan"],
  ["/admin/payroll/pengaturan", "payroll.pengaturan"],
  ["/admin/absensi/data", "absensi.data"],
  ["/admin/absensi/pengaturan", "absensi.pengaturan"],
  ["/admin/izin/monitoring", "approval.monitoring"],
  ["/admin/alur-approval", "approval.alur"],
  ["/admin/izin/pengaturan", "approval.pengaturan"],
  ["/admin/laporan", "laporan"],
]

// Parsing defensif — kolom `menuAccess` disimpan sebagai Prisma Json, jadi
// bentuknya `unknown` sampai divalidasi di sini (mis. rusak/null/non-array
// dianggap "tidak ada akses" alih-alih error). Key grup lama otomatis
// diterjemahkan ke sub-menu barunya (lihat LEGACY_GROUP_EXPANSION).
export function parseMenuAccess(value: unknown): HrMenuKey[] {
  if (!Array.isArray(value)) return []
  const result = new Set<HrMenuKey>()
  for (const v of value) {
    if (typeof v !== "string") continue
    if (HR_MENU_KEY_SET.has(v)) {
      result.add(v as HrMenuKey)
      continue
    }
    for (const expanded of LEGACY_GROUP_EXPANSION[v] ?? []) {
      result.add(expanded)
    }
  }
  return [...result]
}

export function menuKeyForPath(pathname: string): HrMenuKey | undefined {
  return HR_MENU_PATH_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1]
}
