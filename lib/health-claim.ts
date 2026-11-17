import type { HealthClaimStaffRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { IN_PROGRESS_STATUSES, USED_STATUSES, plafonPeriodYearOfIso } from "@/lib/health-claim-labels"

// Tipe diambil dari client project (yang memakai $extends), bukan Prisma.TransactionClient.
type ClaimDb = Pick<typeof prisma, "healthClaim">

// Logika inti Klaim Kesehatan di sisi server: pengaturan, hak klaim,
// plafon, dan petugas. Lihat docs/prd-klaim-kesehatan.md.

export async function getHealthClaimSettings() {
  const settings = await prisma.healthClaimSettings.findUnique({ where: { id: 1 } })
  return {
    minEmployeesPerMemo: settings?.minEmployeesPerMemo ?? 5,
    submissionDeadlineDays: settings === null ? 30 : settings.submissionDeadlineDays,
    plafonStartMonth: settings?.plafonStartMonth ?? 1,
  }
}

// Periode plafon yang sedang berjalan (menurut tanggal hari ini, WIB).
export function currentPlafonYear(startMonth: number) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
  return plafonPeriodYearOfIso(today, startMonth)
}

export type PlafonSummary = {
  year: number
  plafon: number
  used: number // sudah disetujui / dibayar
  inProgress: number // masih berjalan, ikut menahan plafon
  remaining: number
}

// Plafon dipakai bersama sekeluarga (klaim untuk pasangan/anak mengurangi
// plafon pegawai yang sama). Klaim yang masih berjalan ikut mengurangi sisa
// supaya dua klaim bersamaan tidak sama-sama dibayar penuh melebihi plafon.
export async function getPlafonSummary(
  employeeId: number,
  year: number,
  plafon: number,
  options: { excludeClaimId?: number; tx?: ClaimDb } = {}
): Promise<PlafonSummary> {
  const db = options.tx ?? prisma
  const claims = await db.healthClaim.findMany({
    where: {
      employeeId,
      plafonYear: year,
      status: { in: [...USED_STATUSES, ...IN_PROGRESS_STATUSES] },
      ...(options.excludeClaimId ? { id: { not: options.excludeClaimId } } : {}),
    },
    select: { status: true, requestedAmount: true, approvedAmount: true },
  })
  let used = 0
  let inProgress = 0
  for (const c of claims) {
    const amount = c.approvedAmount ?? c.requestedAmount
    if ((USED_STATUSES as string[]).includes(c.status)) used += amount
    else inProgress += amount
  }
  return { year, plafon, used, inProgress, remaining: Math.max(0, plafon - used - inProgress) }
}

export type ClaimEligibility =
  | { eligible: true; plafon: number }
  | { eligible: false; reason: string; plafon: number | null }

export async function getClaimEligibility(employeeId: number): Promise<ClaimEligibility> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      isActive: true,
      isDeleted: true,
      employmentStatus: { select: { name: true, healthClaimEligibility: { select: { employmentStatusId: true } } } },
      position: { select: { name: true, healthClaimPlafon: { select: { amount: true } } } },
    },
  })
  if (!employee || employee.isDeleted) return { eligible: false, reason: "Data pegawai tidak ditemukan.", plafon: null }
  const plafon = employee.position.healthClaimPlafon?.amount ?? null
  if (!employee.isActive) {
    return { eligible: false, reason: "Akun pegawai Anda tidak aktif, sehingga tidak bisa mengajukan klaim baru.", plafon }
  }
  if (!employee.employmentStatus.healthClaimEligibility) {
    return {
      eligible: false,
      reason: `Pegawai berstatus ${employee.employmentStatus.name} belum berhak mengajukan klaim kesehatan.`,
      plafon,
    }
  }
  if (plafon === null) {
    return {
      eligible: false,
      reason: `Plafon klaim untuk jabatan ${employee.position.name} belum diatur. Silakan hubungi HR.`,
      plafon,
    }
  }
  return { eligible: true, plafon }
}

export async function getStaffEmployeeIds(role: HealthClaimStaffRole): Promise<number[]> {
  const rows = await prisma.healthClaimStaff.findMany({ where: { role }, select: { employeeId: true } })
  return rows.map((r) => r.employeeId)
}

export async function getStaffUserIds(role: HealthClaimStaffRole): Promise<number[]> {
  const employeeIds = await getStaffEmployeeIds(role)
  if (employeeIds.length === 0) return []
  const users = await prisma.user.findMany({
    where: { employeeId: { in: employeeIds }, isActive: true },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

export async function isHealthClaimStaff(employeeId: number | null | undefined, role: HealthClaimStaffRole) {
  if (!employeeId) return false
  const row = await prisma.healthClaimStaff.findUnique({ where: { employeeId_role: { employeeId, role } } })
  return Boolean(row)
}

// Nomor klaim berurut per tahun pengajuan: KLM-2026-0001. Dihitung di dalam
// transaksi; tabrakan nomor (dua pengajuan di milidetik yang sama) ditangani
// pemanggil dengan mencoba ulang karena kolomnya unik.
export async function nextClaimNumber(tx: ClaimDb, year: number) {
  const prefix = `KLM-${year}-`
  const last = await tx.healthClaim.findFirst({
    where: { claimNumber: { startsWith: prefix } },
    orderBy: { claimNumber: "desc" },
    select: { claimNumber: true },
  })
  const next = last ? Number(last.claimNumber.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(next).padStart(4, "0")}`
}

// Yang boleh mengonfirmasi/merevisi/menolak klaim: petugas klaim yang
// ditunjuk di Pengaturan, atau Super Admin (cadangan bila petugas berhalangan).
export async function canReviewHealthClaims(user: { role: string; employeeId?: number | null } | undefined) {
  if (!user) return false
  if (user.role === "SUPER_ADMIN") return true
  return isHealthClaimStaff(user.employeeId ?? null, "PETUGAS")
}

export async function getEmployeeUserId(employeeId: number) {
  const user = await prisma.user.findFirst({ where: { employeeId, isActive: true }, select: { id: true } })
  return user?.id ?? null
}

// Antrean Nota Dinas: klaim terkonfirmasi yang belum masuk Nota Dinas.
// Syarat jumlah dihitung per PEGAWAI berbeda, bukan per klaim.
export async function getMemoQueueStats() {
  const rows = await prisma.healthClaim.groupBy({
    by: ["employeeId"],
    where: { status: "TERKONFIRMASI" },
    _count: { _all: true },
    _sum: { approvedAmount: true },
  })
  return {
    employees: rows.length,
    claims: rows.reduce((s, r) => s + r._count._all, 0),
    amount: rows.reduce((s, r) => s + (r._sum.approvedAmount ?? 0), 0),
  }
}

// Sisa plafon untuk MENGONFIRMASI satu klaim. Klaim diproses berurutan sesuai
// waktu pengajuan: klaim yang sudah dikonfirmasi/disetujui, dan klaim lain
// yang diajukan LEBIH DULU dan masih menunggu, mengurangi sisa. Klaim yang
// diajukan belakangan tidak boleh "menyalip" plafon klaim ini.
export async function getRemainingForConfirmation(
  claim: { id: number; employeeId: number; plafonYear: number; submittedAt: Date },
  plafon: number,
  tx: ClaimDb = prisma
) {
  const others = await tx.healthClaim.findMany({
    where: {
      employeeId: claim.employeeId,
      plafonYear: claim.plafonYear,
      id: { not: claim.id },
      OR: [
        { status: { in: ["TERKONFIRMASI", "DALAM_NOTA_DINAS", "DISETUJUI", "DIBAYAR"] } },
        { status: { in: ["MENUNGGU_KONFIRMASI", "REVISI"] }, submittedAt: { lt: claim.submittedAt } },
      ],
    },
    select: { requestedAmount: true, approvedAmount: true },
  })
  const taken = others.reduce((s, c) => s + (c.approvedAmount ?? c.requestedAmount), 0)
  return Math.max(0, plafon - taken)
}

// Untuk sidebar: null = bukan petugas klaim (menu Pemeriksaan Klaim tidak
// ditampilkan); angka = jumlah klaim yang menunggu konfirmasi (badge).
export async function getClaimReviewerBadge(employeeId: number | null | undefined): Promise<number | null> {
  if (!(await isHealthClaimStaff(employeeId, "PETUGAS"))) return null
  return prisma.healthClaim.count({ where: { status: "MENUNGGU_KONFIRMASI", employeeId: { not: employeeId! } } })
}

export type PlafonRecapRow = {
  employeeId: number
  employeeNumber: string
  fullName: string
  position: string
  employmentStatus: string
  isActive: boolean
  plafon: number | null
  used: number
  inProgress: number
  remaining: number | null
  claimCount: number
}

// Rekap plafon per pegawai untuk satu tahun: semua pegawai aktif, ditambah
// pegawai nonaktif yang punya klaim di tahun itu.
export async function getPlafonRecap(year: number): Promise<PlafonRecapRow[]> {
  const [employees, claims] = await Promise.all([
    prisma.employee.findMany({
      where: { isDeleted: false, OR: [{ isActive: true }, { healthClaims: { some: { plafonYear: year } } }] },
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        isActive: true,
        position: { select: { name: true, healthClaimPlafon: { select: { amount: true } } } },
        employmentStatus: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.healthClaim.findMany({
      where: { plafonYear: year, status: { in: [...USED_STATUSES, ...IN_PROGRESS_STATUSES] } },
      select: { employeeId: true, status: true, requestedAmount: true, approvedAmount: true },
    }),
  ])
  const byEmployee = new Map<number, { used: number; inProgress: number; count: number }>()
  for (const c of claims) {
    const agg = byEmployee.get(c.employeeId) ?? { used: 0, inProgress: 0, count: 0 }
    const amount = c.approvedAmount ?? c.requestedAmount
    if ((USED_STATUSES as string[]).includes(c.status)) agg.used += amount
    else agg.inProgress += amount
    agg.count += 1
    byEmployee.set(c.employeeId, agg)
  }
  return employees.map((e) => {
    const agg = byEmployee.get(e.id) ?? { used: 0, inProgress: 0, count: 0 }
    const plafon = e.position.healthClaimPlafon?.amount ?? null
    return {
      employeeId: e.id,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      position: e.position.name,
      employmentStatus: e.employmentStatus.name,
      isActive: e.isActive,
      plafon,
      used: agg.used,
      inProgress: agg.inProgress,
      remaining: plafon === null ? null : Math.max(0, plafon - agg.used - agg.inProgress),
      claimCount: agg.count,
    }
  })
}

// Yang boleh melihat rekap & laporan klaim: Super Admin, HR Admin dengan
// akses menu Klaim Kesehatan atau menu Laporan, petugas klaim, dan Accounting.
export async function canViewHealthClaimReports(user: { role: string; employeeId?: number | null; menuAccess?: string[] }) {
  if (user.role === "SUPER_ADMIN") return true
  if (
    user.role === "HR_ADMIN" &&
    (user.menuAccess?.includes("payroll.klaim-kesehatan") || user.menuAccess?.includes("laporan"))
  ) {
    return true
  }
  if (!user.employeeId) return false
  return Boolean(await prisma.healthClaimStaff.findFirst({ where: { employeeId: user.employeeId }, select: { id: true } }))
}

// Sidebar Accounting: null = bukan Accounting (menu Pembayaran Klaim
// disembunyikan); angka = Nota Dinas yang sudah disetujui tapi belum lunas.
export async function getAccountingBadge(employeeId: number | null | undefined): Promise<number | null> {
  if (!(await isHealthClaimStaff(employeeId, "ACCOUNTING"))) return null
  return prisma.healthClaimMemo.count({ where: { status: "DISETUJUI" } })
}
