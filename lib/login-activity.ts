// Konstanta bersama halaman Aktivitas Login pegawai & aksi "Ini bukan saya".

export const LOGIN_ACTIVITY_ACTIONS = ["LOGIN", "LOGIN_FAILED", "LOGOUT", "LOGOUT_IDLE"] as const
export const REPORTABLE_LOGIN_ACTIONS = ["LOGIN", "LOGIN_FAILED"] as const

// Penanda di deskripsi tiket Laporan Kendala → id ActivityLog yang
// dilaporkan, mis. "[ref-log:123]". Dipakai untuk mencegah laporan ganda dan
// menandai baris yang sudah dilaporkan.
export const LOGIN_REPORT_REF = "[ref-log:"

export function formatLoginTime(date: Date) {
  return date.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
