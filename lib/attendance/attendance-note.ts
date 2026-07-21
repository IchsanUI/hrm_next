// Bandingkan jam absen asli ke jam WorkShift pegawai yang bersangkutan,
// hasilnya disimpan SEKALI ke AttendanceLog.note saat sync (lihat
// lib/attendance/sync.ts) — bukan dihitung ulang tiap kali datanya
// ditampilkan, biar ringan diambil lagi.

export type ShiftTimes = { checkInTime: Date; checkOutTime: Date }

// WorkShift.checkInTime/checkOutTime disimpan sebagai @db.Time(0) dengan
// konvensi "1970-01-01THH:MM:00.000Z" (lihat server/actions/work-shifts.ts
// toTimeDate) — jam sebenarnya diambil lewat getter UTC.
function shiftTimeHHMM(date: Date): string {
  return date.toISOString().slice(11, 16)
}

// AttendanceLog.logTime adalah timestamp asli, di-parse dari string device
// "YYYY-MM-DD HH:MM:SS" TANPA suffix Z (lihat lib/attendance/scraper.ts
// parseAttlog) — jadi jam dinding aslinya diambil lewat getter lokal
// (bukan UTC), match dengan cara ia awalnya di-parse.
function logTimeHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

// null kalau tepat waktu / jenis log-nya bukan Check-In atau Check-Out /
// tidak ada data shift buat dibandingkan (PIN belum dipetakan ke pegawai,
// atau pegawainya belum punya WorkShift).
export function computeAttendanceNote(
  logType: string,
  logTime: Date,
  shift: ShiftTimes | null
): string | null {
  if (!shift) return null

  const actual = logTimeHHMM(logTime)
  if (logType === "Check-In") {
    if (actual > shiftTimeHHMM(shift.checkInTime)) return "Terlambat"
  } else if (logType === "Check-Out") {
    if (actual < shiftTimeHHMM(shift.checkOutTime)) return "Pulang Cepat"
  }
  return null
}
