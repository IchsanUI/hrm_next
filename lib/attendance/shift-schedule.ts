// Jam kerja EFEKTIF per tanggal — jam normal WorkShift, KECUALI tanggal itu
// masuk periode Penyesuaian Jam Kerja (WorkShiftAdjustment, mis. Ramadan),
// maka jam penyesuaiannya yang dipakai. SEMUA hitungan Terlambat/Pulang
// Cepat wajib lewat sini supaya penyesuaian berlaku konsisten di Data
// Absensi, Riwayat Absensi pegawai, Dashboard Absensi, dan laporan.

export type ShiftTimes = { checkInTime: Date; checkOutTime: Date }

export type ShiftAdjustmentPeriod = ShiftTimes & { startDate: Date; endDate: Date }

export type ShiftSchedule = ShiftTimes & { adjustments?: ShiftAdjustmentPeriod[] }

// Pakai di `select: { workShift: { select: SHIFT_SCHEDULE_SELECT } }`.
export const SHIFT_SCHEDULE_SELECT = {
  checkInTime: true,
  checkOutTime: true,
  adjustments: {
    select: { startDate: true, endDate: true, checkInTime: true, checkOutTime: true },
    // Kalau periode tumpang-tindih, yang mulainya paling akhir (paling
    // spesifik) menang — lihat shiftTimesForDate.
    orderBy: { startDate: "desc" as const },
  },
} as const

// startDate/endDate @db.Date → tengah malam UTC; dibaca lewat getter UTC.
function utcDateKey(date: Date) {
  return date.getUTCFullYear() * 10_000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
}

// Tanggal absensi (logTime / hari kalender) → jam dinding LOKAL server
// (TZ Asia/Jakarta), konvensi yang sama dengan lib/attendance/day-summary.ts.
function localDateKey(date: Date) {
  return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate()
}

export function shiftTimesForDate(shift: ShiftSchedule | null | undefined, day: Date): ShiftTimes | null {
  if (!shift) return null
  if (shift.adjustments?.length) {
    const key = localDateKey(day)
    let match: ShiftAdjustmentPeriod | null = null
    for (const a of shift.adjustments) {
      if (utcDateKey(a.startDate) <= key && key <= utcDateKey(a.endDate)) {
        if (!match || a.startDate > match.startDate) match = a
      }
    }
    if (match) return { checkInTime: match.checkInTime, checkOutTime: match.checkOutTime }
  }
  return { checkInTime: shift.checkInTime, checkOutTime: shift.checkOutTime }
}
