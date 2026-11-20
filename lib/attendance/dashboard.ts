import { prisma } from "@/lib/prisma"
import { SHIFT_SCHEDULE_SELECT, shiftTimesForDate } from "@/lib/attendance/shift-schedule"
import { dateKey, summarizeDayTaps } from "@/lib/attendance/day-summary"

// Dashboard Absensi — semua angka diturunkan dari tap mesin (AttendanceLog)
// + izin yang disetujui + hari libur, dengan aturan yang sama seperti Data
// Absensi (lib/attendance/day-summary.ts) dan Proses Payroll
// (lib/payroll/attendance-allowance.ts):
//   - hari kerja = WorkShift.workDays pegawai (bawaan Senin–Jumat), tanpa
//     libur nasional/cuti bersama yang kantornya tutup;
//   - HADIR = ada tap di hari itu; Terlambat/Pulang Cepat dibaca dari jam shift;
//   - IZIN = tidak ada tap tapi tertutup izin/cuti/sakit/dinas yang disetujui;
//   - TIDAK HADIR = hari kerja tanpa tap & tanpa izin (hari ini: "Belum absen").
// Pegawai yang PIN mesinnya belum dipetakan tidak ikut dihitung.

export type DayKind = "HADIR" | "IZIN" | "TIDAK_HADIR" | "BELUM_ABSEN"

export type DayRecord = {
  kind: DayKind
  late: boolean
  lateMinutes: number
  early: boolean
  earlyMinutes: number
  checkIn: Date | null
  checkOut: Date | null
  leaveLabel: string | null
}

export type DashboardEmployee = {
  id: number
  publicId: string
  name: string
  employeeNumber: string
  department: string
  departmentId: number
  position: string
}

const LEAVE_LABEL = {
  cuti: "Cuti",
  cutiBesar: "Cuti Besar",
  unpaid: "Cuti di Luar Tanggungan",
  maternity: "Cuti Bersalin",
  special: "Cuti Khusus",
  sick: "Sakit",
  dispensation: "Dispensasi",
  offSite: "Dinas Luar / Absen Luar Kantor",
} as const

function utcKey(date: Date) {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
}
function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}
function shiftMinutes(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

export type AttendanceMatrix = Awaited<ReturnType<typeof buildAttendanceMatrix>>

// Menghitung status per pegawai per hari kerja dalam rentang [start, end]
// (tanggal lokal, inklusif). Hari setelah hari ini tidak dihitung.
export async function buildAttendanceMatrix(start: Date, end: Date, options: { departmentId?: number } = {}) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = end < today ? end : today
  const rangeEnd = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999)
  const utcStart = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
  const utcEnd = new Date(Date.UTC(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate()))

  const allEmployees = await prisma.employee.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      ...(options.departmentId ? { departmentId: options.departmentId } : {}),
    },
    select: {
      id: true,
      publicId: true,
      fullName: true,
      employeeNumber: true,
      pinAttendance: true,
      startDate: true,
      resignDate: true,
      departmentId: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      workShift: { select: { ...SHIFT_SCHEDULE_SELECT, workDays: true } },
    },
    orderBy: { fullName: "asc" },
  })
  const employees = allEmployees.filter((e) => e.pinAttendance)
  const unmappedCount = allEmployees.length - employees.length
  const ids = employees.map((e) => e.id)
  const pins = employees.map((e) => e.pinAttendance as string)

  const leaveWhere = { employeeId: { in: ids }, status: "APPROVED" as const, startDate: { lte: utcEnd }, endDate: { gte: utcStart } }
  const sel = { employeeId: true, startDate: true, endDate: true } as const
  const [logs, holidays, cuti, cutiBesar, unpaid, maternity, special, sick, dispensation, offSite] = await Promise.all([
    pins.length
      ? prisma.attendanceLog.findMany({
          where: { userPin: { in: pins }, logTime: { gte: start, lte: rangeEnd } },
          select: { userPin: true, logTime: true, location: true },
          orderBy: { logTime: "asc" },
        })
      : Promise.resolve([]),
    prisma.nationalHoliday.findMany({
      where: { date: { gte: utcStart, lte: utcEnd }, isOfficeOpen: false },
      select: { date: true, name: true },
    }),
    prisma.cutiRequest.findMany({ where: leaveWhere, select: sel }),
    prisma.cutiBesarRequest.findMany({ where: leaveWhere, select: sel }),
    prisma.unpaidLeaveRequest.findMany({ where: leaveWhere, select: sel }),
    prisma.maternityLeaveRequest.findMany({ where: leaveWhere, select: sel }),
    prisma.specialLeaveRequest.findMany({ where: leaveWhere, select: sel }),
    prisma.sickLeaveRequest.findMany({ where: leaveWhere, select: sel }),
    prisma.dispensationRequest.findMany({ where: leaveWhere, select: sel }),
    prisma.offSiteAttendanceRequest.findMany({
      where: { employeeId: { in: ids }, status: "APPROVED", date: { gte: utcStart, lte: utcEnd } },
      select: { employeeId: true, date: true },
    }),
  ])

  // Izin per pegawai: kunci tanggal (format dateKey lokal) → label.
  const leaveByEmployee = new Map<number, Map<string, string>>()
  const addLeave = (employeeId: number, key: string, label: string) => {
    let m = leaveByEmployee.get(employeeId)
    if (!m) leaveByEmployee.set(employeeId, (m = new Map()))
    if (!m.has(key)) m.set(key, label)
  }
  const ranges: [readonly { employeeId: number; startDate: Date; endDate: Date }[], string][] = [
    [cuti, LEAVE_LABEL.cuti],
    [cutiBesar, LEAVE_LABEL.cutiBesar],
    [unpaid, LEAVE_LABEL.unpaid],
    [maternity, LEAVE_LABEL.maternity],
    [special, LEAVE_LABEL.special],
    [sick, LEAVE_LABEL.sick],
    [dispensation, LEAVE_LABEL.dispensation],
  ]
  for (const [rows, label] of ranges) {
    for (const r of rows) {
      const cursor = new Date(Math.max(r.startDate.getTime(), utcStart.getTime()))
      const last = Math.min(r.endDate.getTime(), utcEnd.getTime())
      while (cursor.getTime() <= last) {
        addLeave(r.employeeId, utcKey(cursor), label)
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }
  }
  for (const r of offSite) addLeave(r.employeeId, utcKey(r.date), LEAVE_LABEL.offSite)

  const holidayKeys = new Map(holidays.map((h) => [utcKey(h.date), h.name]))

  // Tap per PIN per hari.
  const tapsByPin = new Map<string, Map<string, { logTime: Date; location: string }[]>>()
  for (const l of logs) {
    let byDay = tapsByPin.get(l.userPin)
    if (!byDay) tapsByPin.set(l.userPin, (byDay = new Map()))
    const k = dateKey(l.logTime)
    const list = byDay.get(k)
    if (list) list.push({ logTime: l.logTime, location: l.location })
    else byDay.set(k, [{ logTime: l.logTime, location: l.location }])
  }

  // Daftar hari dalam rentang (lokal).
  const days: Date[] = []
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  const todayKey = dateKey(today)

  const records = new Map<number, Map<string, DayRecord>>()
  for (const e of employees) {
    const workDays = (e.workShift?.workDays ?? "1,2,3,4,5").split(",").map(Number)
    const shiftSchedule = e.workShift ?? null
    const byDay = new Map<string, DayRecord>()
    const empStart = new Date(e.startDate.getUTCFullYear(), e.startDate.getUTCMonth(), e.startDate.getUTCDate())
    const empEnd = e.resignDate
      ? new Date(e.resignDate.getUTCFullYear(), e.resignDate.getUTCMonth(), e.resignDate.getUTCDate())
      : null
    const taps = tapsByPin.get(e.pinAttendance as string)
    const leaves = leaveByEmployee.get(e.id)

    for (const day of days) {
      if (day < empStart || (empEnd && day > empEnd)) continue
      if (!workDays.includes(day.getDay())) continue
      const key = dateKey(day)
      if (holidayKeys.has(key)) continue

      const dayTaps = taps?.get(key)
      if (dayTaps && dayTaps.length) {
        // Jam efektif hari itu (ikut Penyesuaian Jam Kerja, mis. Ramadan).
        const shift = shiftTimesForDate(shiftSchedule, day)
        const summary = summarizeDayTaps(dayTaps, shiftSchedule)
        const late = summary.statuses.includes("TERLAMBAT")
        const early = summary.statuses.includes("PULANG_CEPAT")
        byDay.set(key, {
          kind: "HADIR",
          late,
          lateMinutes: late && shift ? minutesOfDay(summary.checkIn) - shiftMinutes(shift.checkInTime) : 0,
          early,
          earlyMinutes:
            early && shift && summary.checkOut ? shiftMinutes(shift.checkOutTime) - minutesOfDay(summary.checkOut) : 0,
          checkIn: summary.checkIn,
          checkOut: summary.checkOut,
          leaveLabel: null,
        })
        continue
      }
      const leave = leaves?.get(key)
      byDay.set(key, {
        kind: leave ? "IZIN" : key === todayKey ? "BELUM_ABSEN" : "TIDAK_HADIR",
        late: false,
        lateMinutes: 0,
        early: false,
        earlyMinutes: 0,
        checkIn: null,
        checkOut: null,
        leaveLabel: leave ?? null,
      })
    }
    records.set(e.id, byDay)
  }

  const employeeMeta: DashboardEmployee[] = employees.map((e) => ({
    id: e.id,
    publicId: e.publicId,
    name: e.fullName,
    employeeNumber: e.employeeNumber,
    department: e.department.name,
    departmentId: e.departmentId,
    position: e.position.name,
  }))

  return { days, todayKey, employees: employeeMeta, records, unmappedCount, holidayKeys }
}

export type DailyPoint = {
  key: string
  date: Date
  onTime: number
  late: number
  leave: number
  absent: number
  total: number
}

export type RankRow = {
  employeeId: number
  publicId: string
  name: string
  department: string
  count: number
  minutes: number
}

// Ringkasan untuk satu bulan dari matriks.
export function summarizeMonth(matrix: AttendanceMatrix, year: number, month: number) {
  const inMonth = matrix.days.filter((d) => d.getFullYear() === year && d.getMonth() === month)
  const monthKeys = new Set(inMonth.map((d) => dateKey(d)))

  const daily: DailyPoint[] = inMonth
    .map((d) => {
      const key = dateKey(d)
      const p: DailyPoint = { key, date: d, onTime: 0, late: 0, leave: 0, absent: 0, total: 0 }
      for (const e of matrix.employees) {
        const r = matrix.records.get(e.id)?.get(key)
        if (!r) continue
        p.total += 1
        if (r.kind === "HADIR") {
          if (r.late) p.late += 1
          else p.onTime += 1
        } else if (r.kind === "IZIN") p.leave += 1
        else p.absent += 1
      }
      return p
    })
    .filter((p) => p.total > 0)

  const late = new Map<number, RankRow>()
  const absent = new Map<number, RankRow>()
  const early = new Map<number, RankRow>()
  const dept = new Map<string, { name: string; expected: number; present: number; late: number; absent: number }>()
  const weekday = Array.from({ length: 7 }, () => ({ present: 0, late: 0 }))
  const arrivalBins = new Map<number, number>() // menit-sejak-tengah-malam dibulatkan 15 menit → jumlah

  let expected = 0
  let present = 0
  let lateDays = 0
  let lateMinutes = 0
  let earlyDays = 0
  let leaveDays = 0
  let absentDays = 0

  for (const e of matrix.employees) {
    const recs = matrix.records.get(e.id)
    if (!recs) continue
    const d = dept.get(e.department) ?? { name: e.department, expected: 0, present: 0, late: 0, absent: 0 }
    for (const [key, r] of recs) {
      if (!monthKeys.has(key)) continue
      expected += 1
      d.expected += 1
      const [y, m, day] = key.split("-").map(Number)
      const wd = new Date(y, m, day).getDay()
      if (r.kind === "HADIR") {
        present += 1
        d.present += 1
        weekday[wd].present += 1
        if (r.checkIn) {
          const bin = Math.floor((r.checkIn.getHours() * 60 + r.checkIn.getMinutes()) / 15) * 15
          arrivalBins.set(bin, (arrivalBins.get(bin) ?? 0) + 1)
        }
        if (r.late) {
          lateDays += 1
          lateMinutes += r.lateMinutes
          d.late += 1
          weekday[wd].late += 1
          const row = late.get(e.id) ?? { employeeId: e.id, publicId: e.publicId, name: e.name, department: e.department, count: 0, minutes: 0 }
          row.count += 1
          row.minutes += r.lateMinutes
          late.set(e.id, row)
        }
        if (r.early) {
          earlyDays += 1
          const row = early.get(e.id) ?? { employeeId: e.id, publicId: e.publicId, name: e.name, department: e.department, count: 0, minutes: 0 }
          row.count += 1
          row.minutes += r.earlyMinutes
          early.set(e.id, row)
        }
      } else if (r.kind === "IZIN") {
        leaveDays += 1
      } else if (r.kind === "TIDAK_HADIR") {
        absentDays += 1
        d.absent += 1
        const row = absent.get(e.id) ?? { employeeId: e.id, publicId: e.publicId, name: e.name, department: e.department, count: 0, minutes: 0 }
        row.count += 1
        absent.set(e.id, row)
      }
    }
    dept.set(e.department, d)
  }

  const rank = (m: Map<number, RankRow>) =>
    [...m.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes || a.name.localeCompare(b.name))

  return {
    daily,
    totals: {
      expected,
      present,
      lateDays,
      lateMinutes,
      earlyDays,
      leaveDays,
      absentDays,
      attendanceRate: expected ? present / expected : null,
      punctualityRate: present ? (present - lateDays) / present : null,
    },
    topLate: rank(late),
    topAbsent: rank(absent),
    topEarly: rank(early),
    departments: [...dept.values()]
      .filter((d) => d.expected > 0)
      .map((d) => ({ ...d, rate: d.present / d.expected }))
      .sort((a, b) => b.rate - a.rate),
    weekday: [1, 2, 3, 4, 5, 6, 0]
      .map((wd) => ({ weekday: wd, ...weekday[wd] }))
      .filter((w) => w.present > 0),
    arrivals: [...arrivalBins.entries()].sort((a, b) => a[0] - b[0]).map(([minute, count]) => ({ minute, count })),
  }
}

// Status semua pegawai hari ini.
export function summarizeToday(matrix: AttendanceMatrix) {
  const rows = matrix.employees.map((e) => ({ employee: e, record: matrix.records.get(e.id)?.get(matrix.todayKey) ?? null }))
  const scheduled = rows.filter((r) => r.record)
  return {
    isWorkday: scheduled.length > 0,
    holidayName: matrix.holidayKeys.get(matrix.todayKey) ?? null,
    present: scheduled.filter((r) => r.record!.kind === "HADIR"),
    late: scheduled.filter((r) => r.record!.late),
    early: scheduled.filter((r) => r.record!.early),
    leave: scheduled.filter((r) => r.record!.kind === "IZIN"),
    notYet: scheduled.filter((r) => r.record!.kind === "BELUM_ABSEN"),
    scheduledCount: scheduled.length,
  }
}

// Tren bulanan: tingkat kehadiran & jumlah keterlambatan per bulan.
export function summarizeMonths(matrix: AttendanceMatrix, months: { year: number; month: number }[]) {
  return months.map(({ year, month }) => {
    let expected = 0
    let present = 0
    let late = 0
    let absent = 0
    for (const e of matrix.employees) {
      for (const [key, r] of matrix.records.get(e.id) ?? []) {
        const [y, m] = key.split("-").map(Number)
        if (y !== year || m !== month) continue
        expected += 1
        if (r.kind === "HADIR") {
          present += 1
          if (r.late) late += 1
        } else if (r.kind === "TIDAK_HADIR") absent += 1
      }
    }
    return { year, month, expected, present, late, absent, rate: expected ? present / expected : null }
  })
}
