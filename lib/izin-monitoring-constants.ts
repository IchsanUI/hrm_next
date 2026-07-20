import type { IzinHistoryRow } from "@/components/riwayat-izin-content"

// File ini SENGAJA dipisah dari lib/izin-monitoring.ts (yang mengimpor
// prisma) supaya aman diimpor langsung dari client component (filter
// dropdown) tanpa ikut nge-bundle Prisma Client ke browser.
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
]
