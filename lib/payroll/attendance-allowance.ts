import { prisma } from "@/lib/prisma"
import { dateKey } from "@/lib/attendance/day-summary"

// Standar hari kerja tetap SATU angka flat per bulan (kesepakatan
// perusahaan) — TIDAK dihitung ulang dari kalender riil periode ini
// (sengaja tidak melihat cuti bersama/tanggal merah).
export const STANDARD_WORK_DAYS = 22

export type AttendanceAllowanceResult = {
  // SELALU STANDARD_WORK_DAYS (22) — Tunjangan Kehadiran (Pendapatan) TIDAK
  // PERNAH dikurangi lagi di sini (lihat catatan di bawah fungsi ini kenapa
  // ini diubah). Dipertahankan sebagai field terpisah (bukan langsung pakai
  // STANDARD_WORK_DAYS di pemanggil) supaya kontrak lib/payroll/calculate.ts
  // tidak berubah.
  days: number
  uncoveredDays: number // hari yang JADI POTONGAN (Cuti Besar/CDT/Pulang Cepat<12:00/Mangkir) — dikalikan rate buat komponen "Pot. Kehadiran/Punishment" (Potongan), BUKAN mengurangi Tunjangan Kehadiran — cuti tahunan TIDAK termasuk, tetap dibayar
  hasWorkShift: boolean
  breakdown: {
    cutiDays: number // cuti tahunan — info saja, TIDAK ikut mengurangi (tetap dibayar penuh)
    cutiBesarDays: number
    unpaidLeaveDays: number
    earlyLeaveDays: number // Pulang Cepat sebelum jam 12:00
    mangkirDays: number
    presentDaysRaw: number // jumlah hari ada tap absensi di rentang periode (informasi murni, bukan dasar hitung)
    totalWorkDaysInPeriod: number // jumlah hari kerja riil (sesuai WorkShift.workDays) dalam rentang 21-20 periode ini, SUDAH dikecualikan hari libur nasional/cuti bersama
    holidayDaysExcluded: number // jumlah hari libur nasional/cuti bersama (isOfficeOpen=false) yang jatuh di hari kerja shift ini — dikecualikan total, bukan mangkir
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
// - Hari Libur Nasional/Cuti Bersama (NationalHoliday, isOfficeOpen=false)
//   DIKECUALIKAN TOTAL dari perhitungan hari kerja — sama seperti akhir
//   pekan, bukan "mangkir" dan bukan "ditanggung izin", memang bukan hari
//   kerja sama sekali. Kalau isOfficeOpen=true (kantor tetap masuk),
//   tanggal itu tetap dihitung normal (bisa mangkir kalau tidak ada tap).
// - Hari kerja (sesuai WorkShift.workDays pegawai, default Senin-Jumat kalau
//   belum punya WorkShift) yang TIDAK ada tap absensi DAN TIDAK ada izin
//   apa pun yang menutupinya (Sakit/Dispensasi/SPPD/dll) dianggap MANGKIR
//   — ikut mengurangi.
// - Cuti tahunan (approved) TETAP DIBAYAR PENUH (kebijakan perusahaan) —
//   sama seperti Sakit/Dispensasi, tidak mengurangi Tunjangan Kehadiran.
//   Yang mengurangi cuma hari yang benar-benar TIDAK DITANGGUNG: Cuti
//   Besar, Cuti Diluar Tanggungan, dan Pulang Cepat sebelum jam 12 siang
//   (approved, khusus Pulang Cepat<12:00 override status "hadir" jadi
//   "dianggap tidak masuk", sesuai aturan perusahaan) — walau pegawai
//   sebenarnya tap hari itu.
// - Sakit (ket. dokter), Dispensasi/SPPD, dan Absen Luar Kantor (approved)
//   TETAP DITANGGUNG PENUH — tidak mengurangi, dan juga tidak dianggap
//   mangkir.
// - PENTING (revisi): Tunjangan Kehadiran (Pendapatan) SELALU dibayar penuh
//   STANDARD_WORK_DAYS hari — TIDAK dikurangi lagi di sini walau ada
//   Mangkir/dst. Potongannya (uncoveredDays × rate) dipindah jadi baris
//   TERPISAH di komponen "Pot. Kehadiran/Punishment" (kategori Potongan,
//   lihat lib/payroll/calculate.ts) — supaya jumlah Penerimaan/Bruto yang
//   dipakai buat dasar PPh 21 & BPJS TIDAK ikut berubah gara-gara mangkir
//   (disetujui eksplisit, sebelumnya dipotong langsung di komponen
//   Pendapatan yang salah secara pajak).
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

  const [
    sickRequests,
    dispensationRequests,
    offSiteRequests,
    cutiRequests,
    cutiBesarRequests,
    unpaidRequests,
    earlyLeaveRequests,
    holidays,
  ] = await Promise.all([
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
    // Hari libur nasional/cuti bersama yang kantornya TIDAK tetap masuk
    // (isOfficeOpen=false) — dikecualikan total dari perhitungan hari
    // kerja, sama seperti akhir pekan (bukan "mangkir", bukan "ditanggung
    // izin", memang bukan hari kerja sama sekali).
    prisma.nationalHoliday.findMany({
      where: { date: { gte: periodStart, lte: periodEnd }, isOfficeOpen: false },
      select: { date: true },
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

  const holidayDates = new Set(holidays.map((h) => dateKeyUTC(h.date)))

  const workdayDates = expandDateRange(periodStart, periodEnd, periodStart, periodEnd)
  let cutiDays = 0
  let cutiBesarDays = 0
  let unpaidLeaveDays = 0
  let earlyLeaveDays = 0
  let mangkirDays = 0
  let totalWorkDaysInPeriod = 0
  let holidayDaysExcluded = 0
  for (const day of workdayDates) {
    const [y, m, d] = day.split("-").map(Number)
    const weekday = new Date(Date.UTC(y, m, d)).getUTCDay()
    if (!workDays.includes(weekday)) continue // bukan hari kerja shift ini, dilewati
    if (holidayDates.has(day)) {
      holidayDaysExcluded += 1
      continue // hari libur nasional/cuti bersama — dikecualikan total, bukan mangkir
    }
    totalWorkDaysInPeriod += 1

    if (cutiDates.has(day)) {
      // cuti tahunan tetap dibayar penuh — dihitung buat info, tidak mengurangi
      cutiDays += 1
    } else if (cutiBesarDates.has(day)) cutiBesarDays += 1
    else if (unpaidLeaveDates.has(day)) unpaidLeaveDays += 1
    else if (earlyLeaveDates.has(day)) earlyLeaveDays += 1
    else if (presentDates.has(day) || coveredDates.has(day)) {
      // hadir atau ditanggung — tidak mengurangi
    } else {
      mangkirDays += 1 // mangkir tanpa keterangan
    }
  }

  const uncoveredDays = cutiBesarDays + unpaidLeaveDays + earlyLeaveDays + mangkirDays

  return {
    days: STANDARD_WORK_DAYS,
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
      holidayDaysExcluded,
    },
  }
}
