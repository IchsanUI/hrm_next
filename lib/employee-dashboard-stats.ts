import { prisma } from "@/lib/prisma"

export type QuickAccessItem = {
  key: string
  label: string
  href: string
  count: number
}

// Jenis izin yang paling sering diajukan pegawai — dipakai buat shortcut
// "Akses Cepat Izin" di dashboard pegawai.
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
  { key: "cuti_khusus", label: "Cuti Khusus", href: "/pegawai/ajukan-izin/cuti-khusus" },
] as const

// Total pengajuan sepanjang waktu (all-time) milik pegawai ini per jenis —
// dipakai kartu "Akses Cepat Izin" di dashboard pegawai.
export async function getEmployeeQuickAccessCounts(employeeId: number): Promise<QuickAccessItem[]> {
  const [lembur, terlambat, pulangCepat, sakit, meninggalkanKantor, cutiKhusus] = await Promise.all([
    prisma.overtimeRequest.count({ where: { employeeId } }),
    prisma.lateArrivalRequest.count({ where: { employeeId } }),
    prisma.earlyLeaveRequest.count({ where: { employeeId } }),
    prisma.sickLeaveRequest.count({ where: { employeeId } }),
    prisma.officeExitRequest.count({ where: { employeeId } }),
    prisma.specialLeaveRequest.count({ where: { employeeId } }),
  ])
  const counts = [lembur, terlambat, pulangCepat, sakit, meninggalkanKantor, cutiKhusus]

  return QUICK_ACCESS_DEFS.map((def, i) => ({ ...def, count: counts[i] }))
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
