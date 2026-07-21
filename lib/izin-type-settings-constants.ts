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

export type IzinTypeSettingRow = {
  leaveType: string
  isActive: boolean
  submissionCutoffTime: string | null
}
