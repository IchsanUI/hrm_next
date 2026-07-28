// File ini SENGAJA dipisah dari lib/izin-type-settings.ts (yang mengimpor
// prisma) supaya aman diimpor langsung dari client component
// (components/izin-type-settings-table.tsx) tanpa ikut nge-bundle Prisma
// Client ke browser.

// Jenis izin "hari itu juga" — cuma jenis ini yang punya field jam batas
// pengajuan (submissionCutoffTime) di UI Pengaturan Izin. Jenis cuti yang
// biasa diajukan jauh-jauh hari (Cuti, Cuti Besar, dst.) cuma punya toggle
// aktif/nonaktif.
export const IZIN_TYPES_WITH_CUTOFF = new Set([
  "IZIN_LEMBUR",
  "IZIN_MENINGGALKAN_KANTOR",
  "IZIN_SAKIT",
  "IZIN_PULANG_CEPAT",
  "IZIN_TERLAMBAT",
])

// Jenis izin yang rawan disalahgunakan kalau diajukan berkali-kali tanpa
// batas (izin "pernyataan sendiri" tanpa bukti fingerprint) — cuma jenis ini
// yang punya field Batas Pengajuan per Bulan di UI Pengaturan Izin. Lihat
// getIzinTypeBlockReason di lib/izin-type-settings.ts buat penegakannya.
export const IZIN_TYPES_WITH_MONTHLY_LIMIT = new Set([
  "IZIN_ABSEN_LUAR_KANTOR",
  "IZIN_TIDAK_ABSEN",
])

export type IzinTypeSettingRow = {
  leaveType: string
  isActive: boolean
  submissionCutoffTime: string | null
  submissionLimitPerMonth: number | null
}
