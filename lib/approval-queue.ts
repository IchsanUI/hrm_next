import { prisma } from "@/lib/prisma"
import type { ApprovalQueueRow } from "@/components/approval-center-content"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

const OFFICE_EXIT_CATEGORY_LABEL: Record<string, string> = {
  PRIBADI: "Urusan Pribadi",
  DINAS: "Urusan Dinas",
}

export async function getApprovalCenterData(approverId: number | null | undefined) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  if (!approverId) {
    return { queue: [] as ApprovalQueueRow[], approvedThisMonth: 0, rejectedThisMonth: 0 }
  }

  const [
    pendingOvertimeSteps,
    pendingOfficeExitSteps,
    pendingEarlyLeaveSteps,
    pendingLateArrivalSteps,
    approvedOvertime,
    rejectedOvertime,
    approvedOfficeExit,
    rejectedOfficeExit,
    approvedEarlyLeave,
    rejectedEarlyLeave,
    approvedLateArrival,
    rejectedLateArrival,
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
  ])

  const queue: ApprovalQueueRow[] = [
    ...pendingOvertimeSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "lembur",
        applicant: s.request.employee.fullName,
        type: "Izin Lembur",
        date: formatDate(s.request.date),
        summary: s.request.task,
      })
    ),
    ...pendingOfficeExitSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "meninggalkan_kantor",
        applicant: s.request.employee.fullName,
        type: "Izin Meninggalkan Kantor",
        date: formatDate(s.request.createdAt),
        summary: `${OFFICE_EXIT_CATEGORY_LABEL[s.request.category]} — keluar pukul ${s.request.plannedExitTime}`,
      })
    ),
    ...pendingEarlyLeaveSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "pulang_cepat",
        applicant: s.request.employee.fullName,
        type: "Izin Pulang Cepat",
        date: formatDate(s.request.createdAt),
        summary: `Pulang pukul ${s.request.plannedLeaveTime} — ${s.request.detail}`,
      })
    ),
    ...pendingLateArrivalSteps.map(
      (s): ApprovalQueueRow => ({
        id: s.request.id,
        publicId: s.request.publicId,
        kind: "terlambat",
        applicant: s.request.employee.fullName,
        type: "Izin Terlambat",
        date: formatDate(s.request.createdAt),
        summary: s.request.reason,
      })
    ),
  ].sort((a, b) => a.id - b.id)

  return {
    queue,
    approvedThisMonth: approvedOvertime + approvedOfficeExit + approvedEarlyLeave + approvedLateArrival,
    rejectedThisMonth: rejectedOvertime + rejectedOfficeExit + rejectedEarlyLeave + rejectedLateArrival,
  }
}
