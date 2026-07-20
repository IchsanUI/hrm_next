// Grup menu admin yang bisa dibuka/tutup per akun HR Admin (lihat Manajemen
// Akses HR). Granularitasnya per-grup (bukan per-item), jadi mencentang satu
// key di sini membuka semua sub-menu di dalam grup itu. SUPER_ADMIN, menu
// "Peraturan" (isinya cuma ubah username/password akun sendiri — lihat
// app/admin/pengaturan), "Approval Center" (wajib buat semua akun yang punya
// identitas pegawai — approver perlu ini buat proses pengajuan izin/cuti
// timnya sendiri, lihat app/admin/layout.tsx), dan menu khusus SUPER_ADMIN
// (Manajemen Akses HR, Log Aktivitas, Manajemen Pengguna) tidak pernah lewat
// mekanisme ini. Key "approval" sengaja TIDAK diganti nama jadi "izin" waktu
// grup menunya diperluas jadi "Izin" (Monitoring Izin, Alur Approval,
// Pengaturan Izin) — biar HR Admin yang sudah pernah diberi akses "approval"
// tidak diam-diam kehilangan akses gara-gara key lama tersaring di
// parseMenuAccess.
export const HR_MENU_GROUPS = [
  { key: "kepegawaian", label: "Kepegawaian" },
  { key: "payroll", label: "Payroll" },
  { key: "absensi", label: "Absensi" },
  { key: "approval", label: "Izin" },
  { key: "laporan", label: "Laporan" },
] as const

export type HrMenuKey = (typeof HR_MENU_GROUPS)[number]["key"]

const HR_MENU_KEY_SET = new Set<string>(HR_MENU_GROUPS.map((g) => g.key))

// Prefix path /admin/** yang dijaga oleh masing-masing grup menu — dipakai di
// proxy.ts (middleware) buat blokir akses langsung lewat URL kalau HR Admin
// yang bersangkutan belum diberi akses ke grup itu. Urutan tidak penting,
// tapi prefix harus persis sama dengan href di app/admin/layout.tsx.
export const HR_MENU_PATH_PREFIXES: [string, HrMenuKey][] = [
  ["/admin/pegawai", "kepegawaian"],
  ["/admin/struktur-organisasi", "kepegawaian"],
  ["/admin/jabatan", "kepegawaian"],
  ["/admin/bagian", "kepegawaian"],
  ["/admin/lokasi-kerja", "kepegawaian"],
  ["/admin/jam-kerja", "kepegawaian"],
  ["/admin/hari-libur", "kepegawaian"],
  ["/admin/saldo-cuti", "kepegawaian"],
  ["/admin/payroll", "payroll"],
  ["/admin/absensi", "absensi"],
  ["/admin/izin/monitoring", "approval"],
  ["/admin/alur-approval", "approval"],
  ["/admin/izin/pengaturan", "approval"],
  ["/admin/laporan", "laporan"],
]

// Parsing defensif — kolom `menuAccess` disimpan sebagai Prisma Json, jadi
// bentuknya `unknown` sampai divalidasi di sini (mis. rusak/null/non-array
// dianggap "tidak ada akses" alih-alih error).
export function parseMenuAccess(value: unknown): HrMenuKey[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is HrMenuKey => typeof v === "string" && HR_MENU_KEY_SET.has(v))
}

export function menuKeyForPath(pathname: string): HrMenuKey | undefined {
  return HR_MENU_PATH_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1]
}
