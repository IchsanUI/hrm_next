// Logika kelompokkan tap mentah (AttendanceLog) jadi satu ringkasan per
// hari — dipakai bareng oleh Riwayat Absensi pegawai (lib/employee-dashboard-stats.ts)
// dan Data Absensi admin (app/admin/absensi/data/page.tsx), supaya cara
// baca jam masuk/pulang & status Terlambat/Pulang Cepat konsisten di
// keduanya.

export type AttendanceStatus = "TERLAMBAT" | "PULANG_CEPAT" | "TEPAT_WAKTU" | "TIDAK_ADA_JAM_KERJA"

export type ShiftTimes = { checkInTime: Date; checkOutTime: Date }

export type AttendanceTap = { logTime: Date; location: string }

export type AttendanceDaySummary = {
  checkIn: Date
  checkInLocation: string // lokasi tap check-in — pegawai kadang tap di lokasi beda pagi/sore (mis. Pusat vs KAS)
  checkInExtraTaps: Date[]
  checkOut: Date | null
  checkOutLocation: string | null
  checkOutExtraTaps: Date[]
  // Array, bukan satu nilai — Terlambat & Pulang Cepat BUKAN saling
  // eksklusif, bisa kejadian bareng di hari yang sama (mis. masuk telat
  // TAPI juga pulang lebih awal dari jadwal).
  statuses: AttendanceStatus[]
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// Menit sejak tengah malam menurut jam DINDING lokal (logTime di-parse
// tanpa suffix Z, lihat lib/attendance/attendance-note.ts).
function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

// WorkShift.checkInTime/checkOutTime cuma nyimpen jam via getter UTC (lihat
// lib/reports/attendance-report.ts) — konvensi yang sama dipakai di sini.
function shiftMinutes(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

// Device absensi sering kirim logType generik ("255", bukan label
// Check-In/Check-Out yang bisa dipercaya), dan pegawai kadang tap DOBEL
// cuma buat mastiin — makanya jam masuk/pulang TIDAK dibaca dari "tap
// pertama/tap terakhir" mentah-mentah, tapi dipisah dari TITIK TENGAH jam
// kerja pegawai: semua tap sebelum titik tengah dianggap upaya check-in,
// semua tap setelah titik tengah dianggap upaya check-out. DI KEDUA sesi,
// tap PALING AWAL yang dijadikan acuan (tap kejadian sebenarnya) dan tap
// sesudahnya di sesi yang sama dianggap "tap dobel buat mastiin" — bukan
// diam-diam dipakai buat menggeser jam pulang jadi lebih akhir dari yang
// benar-benar terjadi.
export function summarizeDayTaps(dayLogs: AttendanceTap[], shift: ShiftTimes | null): AttendanceDaySummary {
  const midpointMinutes = shift
    ? (shiftMinutes(shift.checkInTime) + shiftMinutes(shift.checkOutTime)) / 2
    : 12 * 60 // belum ada jam kerja buat acuan — pakai tengah hari sebagai fallback wajar

  const morningTaps = dayLogs.filter((l) => minutesOfDay(l.logTime) < midpointMinutes)
  const afternoonTaps = dayLogs.filter((l) => minutesOfDay(l.logTime) >= midpointMinutes)

  const checkInSource = morningTaps.length > 0 ? morningTaps : dayLogs.slice(0, 1)
  const checkIn = checkInSource[0].logTime
  const checkInLocation = checkInSource[0].location
  const checkInExtraTaps = checkInSource.slice(1).map((l) => l.logTime)

  const checkOut = afternoonTaps.length > 0 ? afternoonTaps[0].logTime : null
  const checkOutLocation = afternoonTaps.length > 0 ? afternoonTaps[0].location : null
  const checkOutExtraTaps = afternoonTaps.slice(1).map((l) => l.logTime)

  let statuses: AttendanceStatus[]
  if (!shift) {
    statuses = ["TIDAK_ADA_JAM_KERJA"]
  } else {
    statuses = []
    if (minutesOfDay(checkIn) > shiftMinutes(shift.checkInTime)) statuses.push("TERLAMBAT")
    if (checkOut && minutesOfDay(checkOut) < shiftMinutes(shift.checkOutTime)) statuses.push("PULANG_CEPAT")
    if (statuses.length === 0) statuses = ["TEPAT_WAKTU"]
  }

  return { checkIn, checkInLocation, checkInExtraTaps, checkOut, checkOutLocation, checkOutExtraTaps, statuses }
}
