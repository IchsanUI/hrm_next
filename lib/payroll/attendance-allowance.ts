import { prisma } from "@/lib/prisma"
import { dateKey } from "@/lib/attendance/day-summary"
import { getIzinTypeSettings } from "@/lib/izin-type-settings"
import { LEAVE_TYPES } from "@/lib/leave-types"

// Standar hari kerja tetap SATU angka flat per bulan (kesepakatan
// perusahaan) — TIDAK dihitung ulang dari kalender riil periode ini
// (sengaja tidak melihat cuti bersama/tanggal merah).
export const STANDARD_WORK_DAYS = 22

export type LeaveTypeDayCount = { leaveType: string; label: string; days: number }

export type AttendanceAllowanceResult = {
  // SELALU STANDARD_WORK_DAYS (22) — Tunjangan Kehadiran (Pendapatan) TIDAK
  // PERNAH dikurangi lagi di sini (lihat catatan di bawah fungsi ini kenapa
  // ini diubah). Dipertahankan sebagai field terpisah (bukan langsung pakai
  // STANDARD_WORK_DAYS di pemanggil) supaya kontrak lib/payroll/calculate.ts
  // tidak berubah.
  days: number
  uncoveredDays: number // hari yang JADI POTONGAN — jumlah semua breakdown.uncoveredByType[].days + mangkirDays
  hasWorkShift: boolean
  breakdown: {
    standardDays: number
    mangkirDays: number // TIDAK configurable — mangkir (tanpa tap & tanpa izin apa pun) selalu mengurangi
    presentDaysRaw: number // jumlah hari ada tap absensi di rentang periode (informasi murni, bukan dasar hitung)
    totalWorkDaysInPeriod: number // jumlah hari kerja riil (sesuai WorkShift.workDays) dalam rentang periode ini, SUDAH dikecualikan hari libur nasional/cuti bersama
    holidayDaysExcluded: number // jumlah hari libur nasional/cuti bersama (isOfficeOpen=false) yang jatuh di hari kerja shift ini — dikecualikan total, bukan mangkir
    // Rincian per jenis izin — cuma jenis yang punya >=1 hari di periode ini
    // yang muncul. "Mengurangi" ditentukan oleh toggle IzinTypeSetting
    // (Pengaturan Izin), BUKAN hardcode lagi — lihat lib/izin-type-settings.ts.
    uncoveredByType: LeaveTypeDayCount[]
    coveredByType: LeaveTypeDayCount[]
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

function leaveTypeLabel(leaveType: string): string {
  return LEAVE_TYPES.find((t) => t.value === leaveType)?.label ?? leaveType
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
//   — SELALU mengurangi, tidak configurable.
// - Tiap jenis izin full-day (lihat IZIN_TYPES_ELIGIBLE_FOR_ATTENDANCE_TOGGLE
//   di lib/izin-type-settings-constants.ts) apakah MENGURANGI Tunjangan
//   Kehadiran atau TIDAK ditentukan oleh toggle admin di halaman Pengaturan
//   Izin (IzinTypeSetting.reducesAttendanceAllowance) — BUKAN hardcode lagi.
//   Kalau admin belum pernah atur, dipakai default per-jenis yang meniru
//   perilaku lama (lihat defaultSetting() di lib/izin-type-settings.ts).
// - Izin Pulang Cepat cuma dihitung "menutupi hari itu" kalau direncanakan
//   sebelum jam 12 siang (aturan waktu ini TETAP hardcode, cuma APAKAH ikut
//   mengurangi yang configurable).
// - PENTING: Tunjangan Kehadiran (Pendapatan) SELALU dibayar penuh
//   STANDARD_WORK_DAYS hari — TIDAK dikurangi lagi di sini walau ada
//   Mangkir/izin yang mengurangi. Potongannya (uncoveredDays × rate)
//   dipindah jadi baris TERPISAH di komponen "Pot. Kehadiran/Punishment"
//   (kategori Potongan, lihat lib/payroll/calculate.ts) — supaya jumlah
//   Penerimaan/Bruto yang dipakai buat dasar PPh 21 & BPJS TIDAK ikut
//   berubah gara-gara mangkir/izin yang mengurangi.
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
    izinTypeSettings,
    sickRequests,
    dispensationRequests,
    offSiteRequests,
    cutiRequests,
    cutiBesarRequests,
    unpaidRequests,
    maternityRequests,
    specialRequests,
    earlyLeaveRequests,
    holidays,
  ] = await Promise.all([
    getIzinTypeSettings(),
    prisma.sickLeaveRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
    prisma.dispensationRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
    prisma.offSiteAttendanceRequest.findMany({
      where: { employeeId, status: "APPROVED", date: { gte: periodStart, lte: periodEnd } },
      select: { date: true },
    }),
    prisma.cutiRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
    prisma.cutiBesarRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
    prisma.unpaidLeaveRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
    // Cuti Bersalin & Cuti Khusus — SEBELUMNYA tidak dicek sama sekali di
    // sini, diam-diam jatuh ke kategori Mangkir walau approved. Dibetulkan
    // sekalian jadi bagian dari toggle per-jenis izin.
    prisma.maternityLeaveRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
    prisma.specialLeaveRequest.findMany({ where: approvedRangeWhere, select: { startDate: true, endDate: true } }),
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

  const reducesByType = new Map(izinTypeSettings.map((s) => [s.leaveType, s.reducesAttendanceAllowance]))

  function datesFromRanges(rows: { startDate: Date; endDate: Date }[]): Set<string> {
    const dates = new Set<string>()
    for (const r of rows) {
      for (const key of expandDateRange(r.startDate, r.endDate, periodStart, periodEnd)) dates.add(key)
    }
    return dates
  }

  const dispensationDates = new Set<string>()
  for (const r of dispensationRequests) {
    for (const key of expandDateRange(r.startDate, r.endDate, periodStart, periodEnd)) dispensationDates.add(key)
  }
  const offSiteDates = new Set(offSiteRequests.map((r) => dateKeyUTC(r.date)))
  // Pulang cepat sebelum jam 12 siang — tanggalnya diambil dari createdAt
  // (pengajuan real-time hari yang sama, tidak ada field tanggal terpisah
  // di EarlyLeaveRequest). >=12:00 tidak dianggap "menutupi hari itu" sama
  // sekali (bukan bagian dari model ini).
  const earlyLeaveDates = new Set<string>()
  for (const r of earlyLeaveRequests) {
    if (r.plannedLeaveTime < "12:00") earlyLeaveDates.add(dateKey(r.createdAt))
  }

  const holidayDates = new Set(holidays.map((h) => dateKeyUTC(h.date)))

  // Urutan prioritas kalau (secara tidak wajar) lebih dari satu jenis izin
  // menutupi hari yang sama — dipertahankan sama seperti urutan if/else
  // lama, supaya perilaku pada data yang sudah ada tidak berubah.
  const sourcesByPriority: { leaveType: string; dates: Set<string> }[] = [
    { leaveType: "IZIN_CUTI", dates: datesFromRanges(cutiRequests) },
    { leaveType: "CUTI_BESAR", dates: datesFromRanges(cutiBesarRequests) },
    { leaveType: "CUTI_DI_LUAR_TANGGUNGAN", dates: datesFromRanges(unpaidRequests) },
    { leaveType: "CUTI_BERSALIN", dates: datesFromRanges(maternityRequests) },
    { leaveType: "CUTI_KHUSUS_HAJI_UMROH", dates: datesFromRanges(specialRequests) },
    { leaveType: "IZIN_SAKIT", dates: datesFromRanges(sickRequests) },
    { leaveType: "DISPENSASI", dates: dispensationDates },
    { leaveType: "IZIN_ABSEN_LUAR_KANTOR", dates: offSiteDates },
    { leaveType: "IZIN_PULANG_CEPAT", dates: earlyLeaveDates },
  ]

  const workdayDates = expandDateRange(periodStart, periodEnd, periodStart, periodEnd)
  let mangkirDays = 0
  let totalWorkDaysInPeriod = 0
  let holidayDaysExcluded = 0
  const uncoveredCounts = new Map<string, number>()
  const coveredCounts = new Map<string, number>()

  for (const day of workdayDates) {
    const [y, m, d] = day.split("-").map(Number)
    const weekday = new Date(Date.UTC(y, m, d)).getUTCDay()
    if (!workDays.includes(weekday)) continue // bukan hari kerja shift ini, dilewati
    if (holidayDates.has(day)) {
      holidayDaysExcluded += 1
      continue // hari libur nasional/cuti bersama — dikecualikan total, bukan mangkir
    }
    totalWorkDaysInPeriod += 1

    const matchedSource = sourcesByPriority.find((s) => s.dates.has(day))
    if (matchedSource) {
      const reduces = reducesByType.get(matchedSource.leaveType) ?? false
      const counts = reduces ? uncoveredCounts : coveredCounts
      counts.set(matchedSource.leaveType, (counts.get(matchedSource.leaveType) ?? 0) + 1)
    } else if (presentDates.has(day)) {
      // hadir — tidak mengurangi
    } else {
      mangkirDays += 1 // mangkir tanpa keterangan
    }
  }

  const toBreakdownList = (counts: Map<string, number>): LeaveTypeDayCount[] =>
    Array.from(counts.entries()).map(([leaveType, days]) => ({
      leaveType,
      label: leaveTypeLabel(leaveType),
      days,
    }))

  const uncoveredByType = toBreakdownList(uncoveredCounts)
  const coveredByType = toBreakdownList(coveredCounts)
  const uncoveredDays = uncoveredByType.reduce((sum, t) => sum + t.days, 0) + mangkirDays

  return {
    days: STANDARD_WORK_DAYS,
    uncoveredDays,
    hasWorkShift: workShift !== null,
    breakdown: {
      standardDays: STANDARD_WORK_DAYS,
      mangkirDays,
      presentDaysRaw: presentDates.size,
      totalWorkDaysInPeriod,
      holidayDaysExcluded,
      uncoveredByType,
      coveredByType,
    },
  }
}
