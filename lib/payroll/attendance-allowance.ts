import { prisma } from "@/lib/prisma"
import { dateKey } from "@/lib/attendance/day-summary"

// Standar hari kerja tetap SATU angka flat per bulan (kesepakatan
// perusahaan) — TIDAK dihitung ulang dari kalender riil periode ini
// (sengaja tidak melihat cuti bersama/tanggal merah).
export const STANDARD_WORK_DAYS = 22

export type AttendanceAllowanceResult = {
  days: number // hasil akhir (sudah dikurangi, floor 0) — dikalikan rate buat Tunjangan Kehadiran
  uncoveredDays: number // total hari yang mengurangi (cuti/cuti besar/CDT/pulang cepat<12:00/mangkir)
  hasWorkShift: boolean
  breakdown: {
    cutiDays: number
    cutiBesarDays: number
    unpaidLeaveDays: number
    earlyLeaveDays: number // Pulang Cepat sebelum jam 12:00
    mangkirDays: number
    presentDaysRaw: number // jumlah hari ada tap absensi di rentang periode (informasi murni, bukan dasar hitung)
    totalWorkDaysInPeriod: number // jumlah hari kerja riil (sesuai WorkShift.workDays) dalam rentang 21-20 periode ini
  }
}

function dateKeyUTC(date: Date) {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
}

// Set semua dateKey (format sama seperti dateKeyUTC) dari rentang
// startDate..endDate (inklusif, di-@db.Date jadi UTC-midnight = tanggal
// kalender), dipotong ke batas periode payroll.
function expandDateRange(start: Date, end: Date, periodStart: Date, periodEnd: Date): Set<string> {
  const clampedStart = start < periodStart ? periodStart : start
  const clampedEnd = end > periodEnd ? periodEnd : end
  const keys = new Set<string>()
  const cursor = new Date(
    Date.UTC(clampedStart.getUTCFullYear(), clampedStart.getUTCMonth(), clampedStart.getUTCDate())
  )
  const last = Date.UTC(clampedEnd.getUTCFullYear(), clampedEnd.getUTCMonth(), clampedEnd.getUTCDate())
  while (cursor.getTime() <= last) {
    keys.add(dateKeyUTC(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return keys
}

// Hitung berapa hari Tunjangan Kehadiran yang dibayar buat SATU pegawai di
// SATU periode payroll — model "standar 22 hari, dikurangi kalau ada yang
// tidak ditanggung" (didiskusikan & disetujui):
//
// - Hari kerja (sesuai WorkShift.workDays pegawai, default Senin-Jumat kalau
//   belum punya WorkShift) yang TIDAK ada tap absensi DAN TIDAK ada izin
//   apa pun yang menutupinya (Sakit/Dispensasi/SPPD/dll) dianggap MANGKIR
//   — ikut mengurangi.
// - Cuti tahunan, Cuti Besar, Cuti Diluar Tanggungan, dan Pulang Cepat
//   sebelum jam 12 siang (approved) SELALU mengurangi, walau pegawai
//   sebenarnya tap hari itu (khusus Pulang Cepat<12:00 override status
//   "hadir" jadi "dianggap tidak masuk", sesuai aturan perusahaan).
// - Sakit (ket. dokter), Dispensasi/SPPD, dan Absen Luar Kantor (approved)
//   TETAP DITANGGUNG PENUH — tidak mengurangi, dan juga tidak dianggap
//   mangkir.
// - Hasil akhir dibatasi maksimal 22 (tidak pernah dibayar lebih) dan
//   minimal 0 (tidak pernah negatif).
export async function computeAttendanceAllowanceDays(
  employeeId: number,
  pinAttendance: string | null,
  workShift: { workDays: string } | null,
  periodStart: Date,
  periodEnd: Date,
  attendanceRangeStart: Date,
  attendanceRangeEnd: Date
): Promise<AttendanceAllowanceResult> {
  const workDays = (workShift?.workDays ?? "1,2,3,4,5").split(",").map((d) => Number(d))

  const presentDates = new Set<string>()
  if (pinAttendance) {
    const logs = await prisma.attendanceLog.findMany({
      where: { userPin: pinAttendance, logTime: { gte: attendanceRangeStart, lte: attendanceRangeEnd } },
      select: { logTime: true },
    })
    for (const log of logs) presentDates.add(dateKey(log.logTime))
  }

  const approvedRangeWhere = {
    employeeId,
    status: "APPROVED" as const,
    startDate: { lte: periodEnd },
    endDate: { gte: periodStart },
  }

  const [sickRequests, dispensationRequests, offSiteRequests, cutiRequests, cutiBesarRequests, unpaidRequests, earlyLeaveRequests] =
    await Promise.all([
      prisma.sickLeaveRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
      prisma.dispensationRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
      prisma.offSiteAttendanceRequest.findMany({
        where: { employeeId, status: "APPROVED", date: { gte: periodStart, lte: periodEnd } },
        select: { date: true },
      }),
      prisma.cutiRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
      prisma.cutiBesarRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
      prisma.unpaidLeaveRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
      prisma.earlyLeaveRequest.findMany({
        where: {
          employeeId,
          status: "APPROVED",
          createdAt: { gte: attendanceRangeStart, lte: attendanceRangeEnd },
        },
        select: { createdAt: true, plannedLeaveTime: true },
      }),
    ])

  const coveredDates = new Set<string>()
  for (const r of [...sickRequests, ...dispensationRequests]) {
    for (const key of expandDateRange(r.startDate, r.endDate, periodStart, periodEnd)) coveredDates.add(key)
  }
  for (const r of offSiteRequests) coveredDates.add(dateKeyUTC(r.date))

  const cutiDates = new Set<string>()
  for (const r of cutiRequests) {
    for (const key of expandDateRange(r.startDate, r.endDate, periodStart, periodEnd)) cutiDates.add(key)
  }
  const cutiBesarDates = new Set<string>()
  for (const r of cutiBesarRequests) {
    for (const key of expandDateRange(r.startDate, r.endDate, periodStart, periodEnd)) cutiBesarDates.add(key)
  }
  const unpaidLeaveDates = new Set<string>()
  for (const r of unpaidRequests) {
    for (const key of expandDateRange(r.startDate, r.endDate, periodStart, periodEnd)) unpaidLeaveDates.add(key)
  }
  // Pulang cepat sebelum jam 12 siang dianggap tidak masuk kerja hari itu —
  // tanggalnya diambil dari createdAt (pengajuan real-time hari yang sama,
  // tidak ada field tanggal terpisah di EarlyLeaveRequest).
  const earlyLeaveDates = new Set<string>()
  for (const r of earlyLeaveRequests) {
    if (r.plannedLeaveTime < "12:00") {
      earlyLeaveDates.add(dateKey(r.createdAt))
    }
  }

  const workdayDates = expandDateRange(periodStart, periodEnd, periodStart, periodEnd)
  let cutiDays = 0
  let cutiBesarDays = 0
  let unpaidLeaveDays = 0
  let earlyLeaveDays = 0
  let mangkirDays = 0
  let totalWorkDaysInPeriod = 0
  for (const day of workdayDates) {
    const [y, m, d] = day.split("-").map(Number)
    const weekday = new Date(Date.UTC(y, m, d)).getUTCDay()
    if (!workDays.includes(weekday)) continue // bukan hari kerja shift ini, dilewati
    totalWorkDaysInPeriod += 1

    if (cutiDates.has(day)) cutiDays += 1
    else if (cutiBesarDates.has(day)) cutiBesarDays += 1
    else if (unpaidLeaveDates.has(day)) unpaidLeaveDays += 1
    else if (earlyLeaveDates.has(day)) earlyLeaveDays += 1
    else if (presentDates.has(day) || coveredDates.has(day)) {
      // hadir atau ditanggung — tidak mengurangi
    } else {
      mangkirDays += 1 // mangkir tanpa keterangan
    }
  }

  const uncoveredDays = cutiDays + cutiBesarDays + unpaidLeaveDays + earlyLeaveDays + mangkirDays

  return {
    days: Math.max(0, STANDARD_WORK_DAYS - uncoveredDays),
    uncoveredDays,
    hasWorkShift: workShift !== null,
    breakdown: {
      cutiDays,
      cutiBesarDays,
      unpaidLeaveDays,
      earlyLeaveDays,
      mangkirDays,
      presentDaysRaw: presentDates.size,
      totalWorkDaysInPeriod,
    },
  }
}
