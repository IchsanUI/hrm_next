// Label & varian badge Laporan Kendala — dipakai bareng oleh halaman pegawai,
// halaman monitoring admin, dan server action (string literal, bukan enum
// Prisma, supaya aman diimpor dari komponen client).
export const ISSUE_CATEGORIES = ["APLIKASI", "ABSENSI", "PAYROLL", "AKUN", "LAINNYA"] as const
export const ISSUE_STATUSES = ["BARU", "DIPROSES", "SELESAI", "DITOLAK"] as const

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]
export type IssueStatus = (typeof ISSUE_STATUSES)[number]

export const ISSUE_CATEGORY_LABEL: Record<IssueCategory, string> = {
  APLIKASI: "Aplikasi / Tampilan",
  ABSENSI: "Absensi",
  PAYROLL: "Payroll / Slip Gaji",
  AKUN: "Akun & Login",
  LAINNYA: "Lainnya",
}

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  BARU: "Baru",
  DIPROSES: "Diproses",
  SELESAI: "Selesai",
  DITOLAK: "Ditolak",
}

export const ISSUE_STATUS_VARIANT: Record<
  IssueStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  BARU: "destructive",
  DIPROSES: "secondary",
  SELESAI: "default",
  DITOLAK: "outline",
}

// Nomor tiket: LK-<YYMM>-<id 4 digit>, mis. LK-2611-0003. Berbasis id
// auto-increment sehingga unik dan bebas race antar-request; YYMM diambil
// dari tanggal laporan dibuat.
export function buildTicketNumber(id: number, createdAt: Date) {
  const yy = String(createdAt.getFullYear()).slice(-2)
  const mm = String(createdAt.getMonth() + 1).padStart(2, "0")
  return `LK-${yy}${mm}-${String(id).padStart(4, "0")}`
}
