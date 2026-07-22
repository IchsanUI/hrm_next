// File ini SENGAJA dipisah dari lib/izin-monitoring.ts (yang mengimpor
// prisma) supaya aman diimpor langsung dari client component (filter
// dropdown) MAUPUN dari server (mis. lib/reports/izin-monitoring-report.ts)
// tanpa ikut nge-bundle Prisma Client ke browser atau kena error "client
// function called from server" — makanya IzinHistoryRow dan izinStatusLabel/
// izinStatusVariant didefinisikan DI SINI (bukan di riwayat-izin-content.tsx
// yang "use client"), lalu di re-export dari sana buat backward-compat.
export type IzinHistoryRow = {
  id: number
  publicId: string
  kind:
    | "lembur"
    | "meninggalkan_kantor"
    | "pulang_cepat"
    | "terlambat"
    | "sakit"
    | "cuti"
    | "cuti_bersalin"
    | "cuti_khusus"
    | "dispensasi"
    | "cuti_besar"
    | "cuti_diluar_tanggungan"
    | "absen_luar_kantor"
    | "tidak_absen"
  type: string
  date: string
  summary: string
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "COMPLETED" | "REVISI"
  stepLabel: string
  canDelete: boolean
  // Approval APPROVED tapi masih ada langkah kedua yang belum dituntaskan
  // pegawai — Lembur (Tahap 2/laporan hasil) & Terlambat (konfirmasi
  // kedatangan). Lihat izinStatusLabel/izinStatusVariant.
  pendingSecondaryStep: boolean
}

export const STATUS_LABEL: Record<IzinHistoryRow["status"], string> = {
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  COMPLETED: "Disetujui",
  REVISI: "Perlu Revisi",
}

export const STATUS_VARIANT: Record<
  IzinHistoryRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  COMPLETED: "default",
  REVISI: "secondary",
}

// Izin Lembur & Izin Terlambat statusnya tetap "APPROVED" di database
// walau ada langkah kedua yang belum pegawai tuntaskan (Lembur: Tahap 2
// laporan hasil; Terlambat: konfirmasi kedatangan). Kalau kolom Status
// ikut nampilin "Disetujui" di kondisi ini, kelihatan kayak sudah beres
// padahal belum — jadi khusus kombinasi ini, Status dibuat beda dari
// STATUS_LABEL/STATUS_VARIANT biasa, senada sama kolom Step ("Menunggu
// Tahap 2"/"Belum Konfirmasi"). Dipakai di riwayat-izin-content.tsx,
// izin-monitoring-table.tsx, dan laporan Excel/PDF Monitoring Izin supaya
// konsisten di semua tempat.
export function izinStatusLabel(
  kind: IzinHistoryRow["kind"],
  status: IzinHistoryRow["status"],
  pendingSecondaryStep?: boolean
) {
  if (status === "APPROVED" && pendingSecondaryStep) {
    if (kind === "lembur") return "Menunggu Tahap 2"
    if (kind === "terlambat") return "Menunggu Konfirmasi"
  }
  return STATUS_LABEL[status]
}

export function izinStatusVariant(
  kind: IzinHistoryRow["kind"],
  status: IzinHistoryRow["status"],
  pendingSecondaryStep?: boolean
) {
  if (status === "APPROVED" && pendingSecondaryStep && (kind === "lembur" || kind === "terlambat")) {
    return "secondary" as const
  }
  return STATUS_VARIANT[status]
}
export type IzinMonitoringRow = {
  id: number
  publicId: string
  kind: IzinHistoryRow["kind"]
  type: string
  employeeName: string
  employeeNumber: string
  departmentName: string
  date: string
  requestedAt: Date
  summary: string
  status: IzinHistoryRow["status"]
  // Approval APPROVED tapi masih ada langkah kedua yang belum dituntaskan
  // pegawai — Lembur (belum lengkapi Tahap 2/laporan hasil) & Terlambat
  // (belum konfirmasi kedatangan). Dipakai izinStatusLabel/izinStatusVariant
  // buat nampilin status "Menunggu ..." alih-alih "Disetujui", dan buat
  // nge-block pengajuan ini dari fitur cetak PDF sampai step keduanya beres.
  pendingSecondaryStep: boolean
}

// Opsi buat dropdown filter "Jenis Izin" — value-nya sama persis dengan
// `kind` di IzinHistoryRow (dipakai juga di Riwayat Izin) supaya konsisten.
export const IZIN_MONITORING_KIND_OPTIONS: { value: IzinHistoryRow["kind"]; label: string }[] = [
  { value: "lembur", label: "Izin Lembur" },
  { value: "meninggalkan_kantor", label: "Izin Meninggalkan Kantor" },
  { value: "pulang_cepat", label: "Izin Pulang Cepat" },
  { value: "terlambat", label: "Izin Terlambat" },
  { value: "sakit", label: "Izin Sakit" },
  { value: "cuti", label: "Izin Cuti" },
  { value: "cuti_bersalin", label: "Cuti Bersalin / Gugur Kandungan" },
  { value: "cuti_khusus", label: "Cuti Khusus (Haji/Umroh)" },
  { value: "dispensasi", label: "Dispensasi" },
  { value: "cuti_besar", label: "Cuti Besar" },
  { value: "cuti_diluar_tanggungan", label: "Cuti Di Luar Tanggungan" },
  { value: "absen_luar_kantor", label: "Izin Absen Diluar Kantor" },
  { value: "tidak_absen", label: "Izin Tidak Absen Datang/Pulang" },
]
