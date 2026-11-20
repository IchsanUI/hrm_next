// Label & warna Booking Kendaraan — aman dipakai di client maupun server.

export type VehicleBookingStatusValue = "MENUNGGU" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN" | "BERJALAN" | "SELESAI"
export type VehicleStatusValue = "TERSEDIA" | "SERVIS" | "NONAKTIF"

export const BOOKING_STATUS_LABEL: Record<VehicleBookingStatusValue, string> = {
  MENUNGGU: "Menunggu Persetujuan",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
  BERJALAN: "Sedang Dipakai",
  SELESAI: "Selesai",
}

// Kelas badge per status (terang & gelap).
export const BOOKING_STATUS_CLASS: Record<VehicleBookingStatusValue, string> = {
  MENUNGGU: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  DISETUJUI: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  DITOLAK: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  DIBATALKAN: "border-border bg-muted text-muted-foreground",
  BERJALAN: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  SELESAI: "border-border bg-muted text-foreground",
}

// Warna balok di timeline ketersediaan.
export const BOOKING_BAR_CLASS: Partial<Record<VehicleBookingStatusValue, string>> = {
  MENUNGGU: "bg-amber-400/80 dark:bg-amber-500/70",
  DISETUJUI: "bg-blue-500/85 dark:bg-blue-500/75",
  BERJALAN: "bg-emerald-500/85 dark:bg-emerald-500/75",
}

export const VEHICLE_STATUS_LABEL: Record<VehicleStatusValue, string> = {
  TERSEDIA: "Tersedia",
  SERVIS: "Sedang Servis",
  NONAKTIF: "Nonaktif",
}

// Jendela timeline harian (jam lokal).
export const TIMELINE_START_HOUR = 6
export const TIMELINE_END_HOUR = 22

// Batas pengajuan.
export const MAX_BOOKING_HOURS = 72
export const MAX_DAYS_AHEAD = 60

// Odometer wajar (kolom INT); mencegah salah ketik angka berlebih.
export const MAX_ODOMETER_KM = 9_999_999
