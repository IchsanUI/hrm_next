import { prisma } from "@/lib/prisma"
import { dateKey, summarizeDayTaps, type AttendanceStatus, type ShiftTimes } from "@/lib/attendance/day-summary"

export type QuickAccessItem = {
  key: string
  label: string
  href: string
  count: number | null // null = tile shortcut umum (bukan hitungan satu jenis izin tertentu)
}

// Jenis izin yang paling sering diajukan pegawai — dipakai buat shortcut
// "Akses Cepat Izin" di dashboard pegawai. Tile terakhir ("lainnya") BUKAN
// hitungan satu jenis izin, cuma shortcut ke halaman Ajukan Izin lengkap
// (Cuti, Cuti Besar, CDT, Dispensasi, Cuti Khusus, dll.).
const QUICK_ACCESS_DEFS = [
  { key: "lembur", label: "Izin Lembur", href: "/pegawai/ajukan-izin/lembur" },
  { key: "terlambat", label: "Izin Terlambat", href: "/pegawai/ajukan-izin/terlambat" },
  { key: "pulang_cepat", label: "Pulang Cepat", href: "/pegawai/ajukan-izin/pulang-cepat" },
  { key: "sakit", label: "Tidak Masuk (Sakit)", href: "/pegawai/ajukan-izin/sakit" },
  {
    key: "meninggalkan_kantor",
    label: "Meninggalkan Kantor",
    href: "/pegawai/ajukan-izin/meninggalkan-kantor",
  },
] as const

// Total pengajuan sepanjang waktu (all-time) milik pegawai ini per jenis —
// dipakai kartu "Akses Cepat Izin" di dashboard pegawai.
export async function getEmployeeQuickAccessCounts(employeeId: number): Promise<QuickAccessItem[]> {
  const [lembur, terlambat, pulangCepat, sakit, meninggalkanKantor] = await Promise.all([
    prisma.overtimeRequest.count({ where: { employeeId } }),
    prisma.lateArrivalRequest.count({ where: { employeeId } }),
    prisma.earlyLeaveRequest.count({ where: { employeeId } }),
    prisma.sickLeaveRequest.count({ where: { employeeId } }),
    prisma.officeExitRequest.count({ where: { employeeId } }),
  ])
  const counts = [lembur, terlambat, pulangCepat, sakit, meninggalkanKantor]

  return [
    ...QUICK_ACCESS_DEFS.map((def, i) => ({ ...def, count: counts[i] })),
    { key: "lainnya", label: "Izin Lainnya", href: "/pegawai/ajukan-izin", count: null },
  ]
}

// Total pengajuan izin (semua 11 jenis) milik pegawai ini yang masih
// menunggu approval — dipakai stat "Menunggu Approval" di dashboard pegawai.
export async function getEmployeePendingApprovalCount(employeeId: number): Promise<number> {
  const counts = await Promise.all([
    prisma.overtimeRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.officeExitRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.earlyLeaveRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.lateArrivalRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.sickLeaveRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.cutiRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.maternityLeaveRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.specialLeaveRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.dispensationRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.cutiBesarRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
    prisma.unpaidLeaveRequest.count({ where: { employeeId, status: "PENDING_APPROVAL" } }),
  ])
  return counts.reduce((sum, c) => sum + c, 0)
}

// Total pengajuan izin (semua 11 jenis) milik pegawai ini bulan berjalan —
// dipakai stat "Pengajuan Bulan Ini" di dashboard pegawai.
export async function getEmployeeMonthlySubmissionCount(
  employeeId: number,
  now: Date = new Date()
): Promise<number> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const createdAtThisMonth = { employeeId, createdAt: { gte: monthStart } }

  const counts = await Promise.all([
    prisma.overtimeRequest.count({ where: createdAtThisMonth }),
    prisma.officeExitRequest.count({ where: createdAtThisMonth }),
    prisma.earlyLeaveRequest.count({ where: createdAtThisMonth }),
    prisma.lateArrivalRequest.count({ where: createdAtThisMonth }),
    prisma.sickLeaveRequest.count({ where: createdAtThisMonth }),
    prisma.cutiRequest.count({ where: createdAtThisMonth }),
    prisma.maternityLeaveRequest.count({ where: createdAtThisMonth }),
    prisma.specialLeaveRequest.count({ where: createdAtThisMonth }),
    prisma.dispensationRequest.count({ where: createdAtThisMonth }),
    prisma.cutiBesarRequest.count({ where: createdAtThisMonth }),
    prisma.unpaidLeaveRequest.count({ where: createdAtThisMonth }),
  ])
  return counts.reduce((sum, c) => sum + c, 0)
}

export type EmployeeAttendanceRow = {
  id: number
  logTime: Date
  location: string
  verifyType: string
}

// Beberapa log absensi terakhir milik pegawai ini, langsung dari
// AttendanceLog (data lokal hasil scraping mesin fingerprint) — bukan
// scraping baru. Cuma dipanggil kalau Employee.pinAttendance sudah
// dipetakan (lihat app/pegawai/dashboard/page.tsx).
export async function getEmployeeRecentAttendance(
  pinAttendance: string,
  limit: number = 5
): Promise<EmployeeAttendanceRow[]> {
  return prisma.attendanceLog.findMany({
    where: { userPin: pinAttendance },
    orderBy: { logTime: "desc" },
    take: limit,
    select: { id: true, logTime: true, location: true, verifyType: true },
  })
}

export type EmployeeAttendanceStatus = AttendanceStatus

export type EmployeeAttendanceDayRow = {
  date: Date
  checkIn: Date
  checkInLocation: string
  checkInExtraTaps: Date[] // tap pagi lain selain checkIn (mis. tap dobel "mastiin") — ditampilkan muted di UI
  checkOut: Date | null
  checkOutLocation: string | null
  checkOutExtraTaps: Date[] // tap sore lain selain checkOut
  statuses: EmployeeAttendanceStatus[]
}

export type EmployeeShiftTimes = ShiftTimes

// Riwayat absensi milik pegawai ini dalam rentang tanggal tertentu,
// DIKELOMPOKKAN PER HARI (bukan per tap mesin) — satu tanggal = satu baris.
// Logika pisah jam masuk/pulang & status Terlambat/Pulang Cepat ada di
// lib/attendance/day-summary.ts (dipakai bareng sama Data Absensi admin).
export async function getEmployeeAttendanceHistory(
  pinAttendance: string,
  range: { from: Date; to: Date },
  shift: EmployeeShiftTimes | null
): Promise<EmployeeAttendanceDayRow[]> {
  const logs = await prisma.attendanceLog.findMany({
    where: { userPin: pinAttendance, logTime: { gte: range.from, lte: range.to } },
    orderBy: { logTime: "asc" },
    take: 20000,
    select: { logTime: true, location: true },
  })

  const byDate = new Map<string, typeof logs>()
  for (const log of logs) {
    const key = dateKey(log.logTime)
    const arr = byDate.get(key)
    if (arr) arr.push(log)
    else byDate.set(key, [log])
  }

  const rows: EmployeeAttendanceDayRow[] = Array.from(byDate.values()).map((dayLogs) => {
    const summary = summarizeDayTaps(dayLogs, shift)
    return { date: summary.checkIn, ...summary }
  })

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime())
}
