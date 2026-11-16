// Data yang boleh di-"Arsip & Bersihkan" — SENGAJA cuma tabel log yang
// tidak dipakai sebagai data induk oleh modul lain (pegawai, payroll, izin
// tidak pernah masuk sini). Aman diimpor dari komponen client.

export const ARCHIVE_TARGETS = ["attendance_logs", "activity_logs", "notifications"] as const
export type ArchiveTarget = (typeof ARCHIVE_TARGETS)[number]

export const ARCHIVE_MONTH_OPTIONS = [3, 6, 12, 24] as const

export const ARCHIVE_TARGET_INFO: Record<
  ArchiveTarget,
  { label: string; description: string; defaultMonths: number; note?: string }
> = {
  attendance_logs: {
    label: "Log Absensi (fingerprint)",
    description: "Data tap mesin fingerprint.",
    defaultMonths: 12,
    note:
      "Riwayat absensi, rekap KPI, dan laporan untuk periode yang diarsipkan tidak akan tampil sampai arsipnya di-import ulang. Sync otomatis hanya mengambil data hari ini, jadi data lama tidak masuk lagi sendiri — kecuali admin menarik tanggal lama secara manual dari mesin.",
  },
  activity_logs: {
    label: "Log Aktivitas",
    description: "Jejak audit login & perubahan data.",
    defaultMonths: 6,
    note: "Jejak audit periode itu hilang dari halaman Log Aktivitas sampai di-import ulang.",
  },
  notifications: {
    label: "Notifikasi yang sudah dibaca",
    description: "Notifikasi in-app yang sudah dibaca pengguna.",
    defaultMonths: 3,
  },
}

export function isArchiveTarget(value: unknown): value is ArchiveTarget {
  return typeof value === "string" && (ARCHIVE_TARGETS as readonly string[]).includes(value)
}
