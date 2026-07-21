import { prisma } from "@/lib/prisma"

export type FrequencyRow = { label: string; count: number }

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// monthOffset negatif = bulan lalu, 0 = bulan ini, positif = bulan depan.
function monthStart(date: Date, monthOffset: number) {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1)
}

const IZIN_KIND_LABELS = [
  "Izin Lembur",
  "Izin Meninggalkan Kantor",
  "Izin Pulang Cepat",
  "Izin Terlambat",
  "Izin Sakit",
  "Izin Cuti",
  "Cuti Bersalin / Gugur Kandungan",
  "Cuti Khusus (Haji/Umroh)",
  "Dispensasi",
  "Cuti Besar",
  "Cuti Di Luar Tanggungan",
] as const

// Dipanggil sekali dari dashboard — ambil createdAt 6 bulan terakhir dari
// tiap tabel pengajuan izin sekaligus, lalu dipakai untuk dua chart berbeda
// (frekuensi per jenis bulan ini & tren 6 bulan) supaya tidak query dobel.
export async function getIzinFrequencyAndTrend(
  now: Date = new Date()
): Promise<{ frequency: FrequencyRow[]; trend: FrequencyRow[] }> {
  const since = monthStart(now, -5) // 6 bulan termasuk bulan berjalan
  const currentMonthStart = startOfMonth(now)
  const createdAtSince = { createdAt: { gte: since } }
  const selectCreatedAt = { select: { createdAt: true } }

  const groups = await Promise.all([
    prisma.overtimeRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.officeExitRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.earlyLeaveRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.lateArrivalRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.sickLeaveRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.cutiRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.maternityLeaveRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.specialLeaveRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.dispensationRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.cutiBesarRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
    prisma.unpaidLeaveRequest.findMany({ where: createdAtSince, ...selectCreatedAt }),
  ])

  const frequency: FrequencyRow[] = IZIN_KIND_LABELS.map((label, i) => ({
    label,
    count: groups[i].filter((r) => r.createdAt >= currentMonthStart).length,
  })).sort((a, b) => b.count - a.count)

  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const start = monthStart(now, -5 + i)
    return {
      label: start.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      start,
      end: monthStart(now, -5 + i + 1),
    }
  })
  const allDates = groups.flat().map((r) => r.createdAt)
  const trend: FrequencyRow[] = monthBuckets.map((bucket) => ({
    label: bucket.label,
    count: allDates.filter((d) => d >= bucket.start && d < bucket.end).length,
  }))

  return { frequency, trend }
}

export async function getPendingApprovalCount(): Promise<number> {
  const counts = await Promise.all([
    prisma.overtimeRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.officeExitRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.earlyLeaveRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.lateArrivalRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.sickLeaveRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.cutiRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.maternityLeaveRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.specialLeaveRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.dispensationRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.cutiBesarRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.unpaidLeaveRequest.count({ where: { status: "PENDING_APPROVAL" } }),
  ])
  return counts.reduce((sum, c) => sum + c, 0)
}

export async function getDepartmentDistribution(): Promise<FrequencyRow[]> {
  const departments = await prisma.department.findMany({
    select: {
      name: true,
      _count: { select: { employees: { where: { isDeleted: false, isActive: true } } } },
    },
  })
  return departments
    .map((d) => ({ label: d.name, count: d._count.employees }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
}

export type RecentActivityRow = {
  id: number
  username: string
  action: string
  entityType: string
  description: string
  createdAt: Date
}

export async function getRecentActivity(limit: number = 8): Promise<RecentActivityRow[]> {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      username: true,
      action: true,
      entityType: true,
      description: true,
      createdAt: true,
    },
  })
}

export type BirthdayRow = {
  id: number
  publicId: string
  fullName: string
  photoUrl: string | null
  departmentName: string
  positionName: string
  birthDay: number
  turningAge: number
}

// birthDate tersimpan sebagai @db.Date (UTC tengah malam) — pakai getter UTC
// supaya bulan/tanggalnya tidak bergeser gara-gara timezone lokal server.
export async function getBirthdaysThisMonth(now: Date = new Date()): Promise<BirthdayRow[]> {
  const employees = await prisma.employee.findMany({
    where: { isDeleted: false, isActive: true },
    select: {
      id: true,
      publicId: true,
      fullName: true,
      photoUrl: true,
      birthDate: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
  })

  const month = now.getUTCMonth()
  return employees
    .filter((e) => e.birthDate.getUTCMonth() === month)
    .map((e) => ({
      id: e.id,
      publicId: e.publicId,
      fullName: e.fullName,
      photoUrl: e.photoUrl,
      departmentName: e.department.name,
      positionName: e.position.name,
      birthDay: e.birthDate.getUTCDate(),
      turningAge: now.getFullYear() - e.birthDate.getUTCFullYear(),
    }))
    .sort((a, b) => a.birthDay - b.birthDay)
}
