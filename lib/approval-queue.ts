import { prisma } from "@/lib/prisma"
import type { ApprovalQueueRow, ApprovalHistoryRow } from "@/components/approval-center-content"
import { MISSED_ATTENDANCE_TYPE_LABEL } from "@/lib/validations/attendance-statement"
import { formatPeriodLabel } from "@/lib/month-names"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

// Dipakai buat filter tanggal di Approval Center (bukan ditampilkan) — format
// yyyy-mm-dd berbasis waktu lokal, biar cocok sama value native <input type="date">.
function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const OFFICE_EXIT_CATEGORY_LABEL: Record<string, string> = {
  PRIBADI: "Urusan Pribadi",
  DINAS: "Urusan Dinas",
}

// Riwayat approval cuma peduli "sudah diproses pegawai ini" — REVISED (step
// Pegawai Pengganti yang menyatakan tidak bersedia) dianggap setara REJECTED
// dari sisi tampilan riwayat, biar approver tetap bisa lihat jejaknya.
const HISTORY_STATUS_MAP: Record<string, ApprovalHistoryRow["status"]> = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISED: "REJECTED",
}

type HistoryStepLike = {
  id: number
  status: string
  actedAt: Date | null
  request: { id: number; publicId: string; createdAt: Date; employee: { fullName: string } }
}

function buildHistoryRows<S extends HistoryStepLike>(
  steps: S[],
  kind: ApprovalQueueRow["kind"],
  mapRequest: (s: S) => { type: string; date: string; summary: string }
): (ApprovalHistoryRow & { sortAt: Date })[] {
  return steps
    .filter((s) => s.actedAt)
    .map((s) => {
      const { type, date, summary } = mapRequest(s)
      return {
        id: s.request.id,
        publicId: s.request.publicId,
        kind,
        applicant: s.request.employee.fullName,
        type,
        date,
        dateValue: toDateValue(s.request.createdAt),
        summary,
        status: HISTORY_STATUS_MAP[s.status] ?? "REJECTED",
        actedAt: formatDateTime(s.actedAt as Date),
        sortAt: s.actedAt as Date,
      }
    })
}

// Versi ringan dari getApprovalCenterData — cuma hitung total step yang
// masih IN_PROGRESS milik approver ini, dipakai buat badge angka di menu
// sidebar "Approval Center" (lihat app/admin/layout.tsx & app/pegawai/layout.tsx).
// Sengaja TIDAK pakai getApprovalCenterData (yang juga ambil riwayat 100
// baris + hitung approved/rejected bulan ini) karena badge ini dirender di
// SETIAP halaman lewat layout, jadi harus seringan mungkin.
export async function getPendingApprovalCount(approverId: number | null | undefined): Promise<number> {
  if (!approverId) return 0

  const counts = await Promise.all([
    prisma.overtimeApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.officeExitApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.earlyLeaveApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.lateArrivalApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.sickLeaveApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.cutiApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.maternityLeaveApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.specialLeaveApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.dispensationApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.cutiBesarApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.unpaidLeaveApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.offSiteAttendanceApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    prisma.attendanceStatementApprovalStep.count({ where: { approverId, status: "IN_PROGRESS" } }),
    // Payroll: kolom approver-nya `approverEmployeeId` (bukan `approverId`
    // seperti step izin) karena tabelnya milik modul payroll yang terpisah.
    prisma.payrollApprovalStep.count({
      where: { approverEmployeeId: approverId, status: "IN_PROGRESS" },
    }),
  ])

  return counts.reduce((sum, c) => sum + c, 0)
}

export async function getApprovalCenterData(approverId: number | null | undefined) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  if (!approverId) {
    return {
      queue: [] as ApprovalQueueRow[],
      history: [] as ApprovalHistoryRow[],
      approvedThisMonth: 0,
      rejectedThisMonth: 0,
    }
  }

  const [
    pendingOvertimeSteps,
    pendingOfficeExitSteps,
    pendingEarlyLeaveSteps,
    pendingLateArrivalSteps,
    pendingSickLeaveSteps,
    pendingCutiSteps,
    pendingMaternityLeaveSteps,
    pendingSpecialLeaveSteps,
    pendingDispensationSteps,
    pendingCutiBesarSteps,
    pendingUnpaidLeaveSteps,
    pendingOffSiteAttendanceSteps,
    pendingAttendanceStatementSteps,
    approvedOvertime,
    rejectedOvertime,
    approvedOfficeExit,
    rejectedOfficeExit,
    approvedEarlyLeave,
    rejectedEarlyLeave,
    approvedLateArrival,
    rejectedLateArrival,
    approvedSickLeave,
    rejectedSickLeave,
    approvedCuti,
    rejectedCuti,
    approvedMaternityLeave,
    rejectedMaternityLeave,
    approvedSpecialLeave,
    rejectedSpecialLeave,
    approvedDispensation,
    rejectedDispensation,
    approvedCutiBesar,
    rejectedCutiBesar,
    approvedUnpaidLeave,
    rejectedUnpaidLeave,
    approvedOffSiteAttendance,
    rejectedOffSiteAttendance,
    approvedAttendanceStatement,
    rejectedAttendanceStatement,
    historyOvertimeSteps,
    historyOfficeExitSteps,
    historyEarlyLeaveSteps,
    historyLateArrivalSteps,
    historySickLeaveSteps,
    historyCutiSteps,
    historyMaternityLeaveSteps,
    historySpecialLeaveSteps,
    historyDispensationSteps,
    historyCutiBesarSteps,
    historyUnpaidLeaveSteps,
    historyOffSiteAttendanceSteps,
    historyAttendanceStatementSteps,
  ] = await Promise.all([
    prisma.overtimeApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.officeExitApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.earlyLeaveApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.lateArrivalApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sickLeaveApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cutiApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.maternityLeaveApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.specialLeaveApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dispensationApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cutiBesarApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.unpaidLeaveApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.offSiteAttendanceApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.attendanceStatementApprovalStep.findMany({
      where: { approverId, status: "IN_PROGRESS" },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.overtimeApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.overtimeApprovalStep.count({
      where: { approverId, status: "REJECTED", actedAt: { gte: startOfMonth } },
    }),
    prisma.officeExitApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.officeExitApprovalStep.count({
      where: { approverId, status: "REJECTED", actedAt: { gte: startOfMonth } },
    }),
    prisma.earlyLeaveApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.earlyLeaveApprovalStep.count({
      where: { approverId, status: "REJECTED", actedAt: { gte: startOfMonth } },
    }),
    prisma.lateArrivalApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.lateArrivalApprovalStep.count({
      where: { approverId, status: "REJECTED", actedAt: { gte: startOfMonth } },
    }),
    prisma.sickLeaveApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.sickLeaveApprovalStep.count({
      where: { approverId, status: { in: ["REJECTED", "REVISED"] }, actedAt: { gte: startOfMonth } },
    }),
    prisma.cutiApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.cutiApprovalStep.count({
      where: { approverId, status: { in: ["REJECTED", "REVISED"] }, actedAt: { gte: startOfMonth } },
    }),
    prisma.maternityLeaveApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.maternityLeaveApprovalStep.count({
      where: { approverId, status: { in: ["REJECTED", "REVISED"] }, actedAt: { gte: startOfMonth } },
    }),
    prisma.specialLeaveApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.specialLeaveApprovalStep.count({
      where: { approverId, status: { in: ["REJECTED", "REVISED"] }, actedAt: { gte: startOfMonth } },
    }),
    prisma.dispensationApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.dispensationApprovalStep.count({
      where: { approverId, status: { in: ["REJECTED", "REVISED"] }, actedAt: { gte: startOfMonth } },
    }),
    prisma.cutiBesarApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.cutiBesarApprovalStep.count({
      where: { approverId, status: { in: ["REJECTED", "REVISED"] }, actedAt: { gte: startOfMonth } },
    }),
    prisma.unpaidLeaveApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.unpaidLeaveApprovalStep.count({
      where: { approverId, status: { in: ["REJECTED", "REVISED"] }, actedAt: { gte: startOfMonth } },
    }),
    prisma.offSiteAttendanceApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.offSiteAttendanceApprovalStep.count({
      where: { approverId, status: "REJECTED", actedAt: { gte: startOfMonth } },
    }),
    prisma.attendanceStatementApprovalStep.count({
      where: { approverId, status: "APPROVED", actedAt: { gte: startOfMonth } },
    }),
    prisma.attendanceStatementApprovalStep.count({
      where: { approverId, status: "REJECTED", actedAt: { gte: startOfMonth } },
    }),
    prisma.overtimeApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.officeExitApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.earlyLeaveApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.lateArrivalApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.sickLeaveApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED", "REVISED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.cutiApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED", "REVISED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.maternityLeaveApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED", "REVISED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.specialLeaveApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED", "REVISED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.dispensationApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED", "REVISED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.cutiBesarApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED", "REVISED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.unpaidLeaveApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED", "REVISED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.offSiteAttendanceApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
    prisma.attendanceStatementApprovalStep.findMany({
      where: { approverId, status: { in: ["APPROVED", "REJECTED"] } },
      include: { request: { include: { employee: { select: { fullName: true } } } } },
      orderBy: { actedAt: "desc" },
      take: 50,
    }),
  ])

  // Payroll ikut antrean yang sama supaya penyetuju tidak perlu mengingat
  // ada dua tempat berbeda. Diambil terpisah dari blok Promise.all izin di
  // atas karena bentuk relasinya beda total (subjeknya PERIODE, bukan
  // pengajuan milik seorang pegawai).
  const pendingPayrollSteps = await prisma.payrollApprovalStep.findMany({
    where: { approverEmployeeId: approverId, status: "IN_PROGRESS" },
    include: { payrollPeriod: true },
    orderBy: { createdAt: "desc" },
  })

  const queue: ApprovalQueueRow[] = [
    ...pendingPayrollSteps.map((s): ApprovalQueueRow => ({
      id: s.payrollPeriodId,
      // Payroll tidak punya publicId — id periode dipakai apa adanya karena
      // halaman tinjauannya menjaga akses lewat "apakah Anda penyetujunya",
      // bukan lewat ketidakterkaan URL.
      publicId: String(s.payrollPeriodId),
      kind: "payroll",
      // Tidak ada "pemohon" pegawai — yang relevan adalah HR yang mengajukan.
      applicant: s.payrollPeriod.submittedForApprovalBy ?? "HR",
      type: s.stage === "LOCK" ? "Persetujuan Payroll" : "Koreksi Payroll",
      dateValue: toDateValue(s.createdAt),
      date: formatDate(s.createdAt),
      summary: `Periode ${formatPeriodLabel(s.payrollPeriod.month, s.payrollPeriod.year)}`,
      currentStepType: "PEGAWAI_TERTENTU",
    })),
    ...pendingOvertimeSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "lembur",
        applicant: s.request.employee.fullName,
        type: "Izin Lembur",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.date),
        summary: s.request.task,
        currentStepType: s.approverType,
      })
    ),
    ...pendingOfficeExitSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "meninggalkan_kantor",
        applicant: s.request.employee.fullName,
        type: "Izin Meninggalkan Kantor",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: `${OFFICE_EXIT_CATEGORY_LABEL[s.request.category]} — keluar pukul ${s.request.plannedExitTime}`,
        currentStepType: s.approverType,
      })
    ),
    ...pendingEarlyLeaveSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "pulang_cepat",
        applicant: s.request.employee.fullName,
        type: "Izin Pulang Cepat",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: `Pulang pukul ${s.request.plannedLeaveTime} — ${s.request.detail}`,
        currentStepType: s.approverType,
      })
    ),
    ...pendingLateArrivalSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "terlambat",
        applicant: s.request.employee.fullName,
        type: "Izin Terlambat",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason,
        currentStepType: s.approverType,
      })
    ),
    ...pendingSickLeaveSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "sakit",
        applicant: s.request.employee.fullName,
        type: "Izin Sakit",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason,
        currentStepType: s.approverType,
      })
    ),
    ...pendingCutiSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "cuti",
        applicant: s.request.employee.fullName,
        type: "Izin Cuti",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason,
        currentStepType: s.approverType,
      })
    ),
    ...pendingMaternityLeaveSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "cuti_bersalin",
        applicant: s.request.employee.fullName,
        type: s.request.type === "BERSALIN" ? "Cuti Bersalin" : "Cuti Gugur Kandungan",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason ?? "-",
        currentStepType: s.approverType,
      })
    ),
    ...pendingSpecialLeaveSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "cuti_khusus",
        applicant: s.request.employee.fullName,
        type: s.request.type === "HAJI" ? "Cuti Khusus Haji" : "Cuti Khusus Umroh",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason ?? "-",
        currentStepType: s.approverType,
      })
    ),
    ...pendingDispensationSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "dispensasi",
        applicant: s.request.employee.fullName,
        type: "Dispensasi",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason,
        currentStepType: s.approverType,
      })
    ),
    ...pendingCutiBesarSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "cuti_besar",
        applicant: s.request.employee.fullName,
        type: "Cuti Besar",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason ?? "-",
        currentStepType: s.approverType,
      })
    ),
    ...pendingUnpaidLeaveSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "cuti_diluar_tanggungan",
        applicant: s.request.employee.fullName,
        type: "Cuti Di Luar Tanggungan",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: s.request.reason,
        currentStepType: s.approverType,
      })
    ),
    ...pendingOffSiteAttendanceSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "absen_luar_kantor",
        applicant: s.request.employee.fullName,
        type: "Izin Absen Diluar Kantor",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: `${s.request.location} — ${s.request.reason}`,
        currentStepType: s.approverType,
      })
    ),
    ...pendingAttendanceStatementSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "tidak_absen",
        applicant: s.request.employee.fullName,
        type: "Izin Tidak Absen",
        dateValue: toDateValue(s.request.createdAt),
        date: formatDate(s.request.createdAt),
        summary: `${MISSED_ATTENDANCE_TYPE_LABEL[s.request.missedType]} — ${s.request.reason}`,
        currentStepType: s.approverType,
      })
    ),
  ].sort((a, b) => a.id - b.id)

  const history: ApprovalHistoryRow[] = [
    ...buildHistoryRows(historyOvertimeSteps, "lembur", (s) => ({
      type: "Izin Lembur",
      date: formatDate(s.request.date),
      summary: s.request.task,
    })),
    ...buildHistoryRows(historyOfficeExitSteps, "meninggalkan_kantor", (s) => ({
      type: "Izin Meninggalkan Kantor",
      date: formatDate(s.request.createdAt),
      summary: `${OFFICE_EXIT_CATEGORY_LABEL[s.request.category]} — keluar pukul ${s.request.plannedExitTime}`,
    })),
    ...buildHistoryRows(historyEarlyLeaveSteps, "pulang_cepat", (s) => ({
      type: "Izin Pulang Cepat",
      date: formatDate(s.request.createdAt),
      summary: `Pulang pukul ${s.request.plannedLeaveTime} — ${s.request.detail}`,
    })),
    ...buildHistoryRows(historyLateArrivalSteps, "terlambat", (s) => ({
      type: "Izin Terlambat",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason,
    })),
    ...buildHistoryRows(historySickLeaveSteps, "sakit", (s) => ({
      type: "Izin Sakit",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason,
    })),
    ...buildHistoryRows(historyCutiSteps, "cuti", (s) => ({
      type: "Izin Cuti",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason,
    })),
    ...buildHistoryRows(historyMaternityLeaveSteps, "cuti_bersalin", (s) => ({
      type: s.request.type === "BERSALIN" ? "Cuti Bersalin" : "Cuti Gugur Kandungan",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason ?? "-",
    })),
    ...buildHistoryRows(historySpecialLeaveSteps, "cuti_khusus", (s) => ({
      type: s.request.type === "HAJI" ? "Cuti Khusus Haji" : "Cuti Khusus Umroh",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason ?? "-",
    })),
    ...buildHistoryRows(historyDispensationSteps, "dispensasi", (s) => ({
      type: "Dispensasi",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason,
    })),
    ...buildHistoryRows(historyCutiBesarSteps, "cuti_besar", (s) => ({
      type: "Cuti Besar",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason ?? "-",
    })),
    ...buildHistoryRows(historyUnpaidLeaveSteps, "cuti_diluar_tanggungan", (s) => ({
      type: "Cuti Di Luar Tanggungan",
      date: formatDate(s.request.createdAt),
      summary: s.request.reason,
    })),
    ...buildHistoryRows(historyOffSiteAttendanceSteps, "absen_luar_kantor", (s) => ({
      type: "Izin Absen Diluar Kantor",
      date: formatDate(s.request.createdAt),
      summary: `${s.request.location} — ${s.request.reason}`,
    })),
    ...buildHistoryRows(historyAttendanceStatementSteps, "tidak_absen", (s) => ({
      type: "Izin Tidak Absen",
      date: formatDate(s.request.createdAt),
      summary: `${MISSED_ATTENDANCE_TYPE_LABEL[s.request.missedType]} — ${s.request.reason}`,
    })),
  ]
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
    .slice(0, 100)
    .map(
      (row): ApprovalHistoryRow => ({
        id: row.id,
        publicId: row.publicId,
        kind: row.kind,
        applicant: row.applicant,
        type: row.type,
        date: row.date,
        dateValue: row.dateValue,
        summary: row.summary,
        status: row.status,
        actedAt: row.actedAt,
      })
    )

  return {
    queue,
    history,
    approvedThisMonth:
      approvedOvertime +
      approvedOfficeExit +
      approvedEarlyLeave +
      approvedLateArrival +
      approvedSickLeave +
      approvedCuti +
      approvedMaternityLeave +
      approvedSpecialLeave +
      approvedDispensation +
      approvedCutiBesar +
      approvedUnpaidLeave +
      approvedOffSiteAttendance +
      approvedAttendanceStatement,
    rejectedThisMonth:
      rejectedOvertime +
      rejectedOfficeExit +
      rejectedEarlyLeave +
      rejectedLateArrival +
      rejectedSickLeave +
      rejectedCuti +
      rejectedMaternityLeave +
      rejectedSpecialLeave +
      rejectedDispensation +
      rejectedCutiBesar +
      rejectedUnpaidLeave +
      rejectedOffSiteAttendance +
      rejectedAttendanceStatement,
  }
}
