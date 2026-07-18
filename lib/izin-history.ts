import { prisma } from "@/lib/prisma"
import type { IzinHistoryRow } from "@/components/riwayat-izin-content"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

const OFFICE_EXIT_CATEGORY_LABEL: Record<string, string> = {
  PRIBADI: "Urusan Pribadi",
  DINAS: "Urusan Dinas",
}

// Label progres approval, dipisah dari kolom Status supaya Status tetap
// seragam (Menunggu Approval / Disetujui / Ditolak) untuk semua jenis izin —
// termasuk Izin Lembur, yang punya tahap tambahan (Lampiran) setelah semua
// step approval selesai.
function computeStepLabel(
  status: string,
  approvalSteps: { status: string }[],
  options?: { isLembur?: boolean; tahap2Done?: boolean }
) {
  const relevantSteps = approvalSteps.filter((s) => s.status !== "SKIPPED")
  const total = relevantSteps.length

  if (status === "REJECTED") {
    const rejectedIndex = relevantSteps.findIndex((s) => s.status === "REJECTED")
    return rejectedIndex === -1 ? "Ditolak" : `Ditolak di Step ${rejectedIndex + 1}`
  }

  if (status === "PENDING_APPROVAL") {
    const activeIndex = relevantSteps.findIndex((s) => s.status === "IN_PROGRESS")
    return activeIndex === -1 ? "-" : `Step ${activeIndex + 1} dari ${total}`
  }

  // Approval sudah tuntas (APPROVED/COMPLETED).
  if (options?.isLembur) {
    return options.tahap2Done ? "Selesai" : "Menunggu Tahap 2"
  }
  return "Selesai"
}

export async function getIzinHistoryRows(
  employeeId: number | null | undefined
): Promise<IzinHistoryRow[]> {
  if (!employeeId) return []

  const [overtimeRequests, officeExitRequests, earlyLeaveRequests, lateArrivalRequests] =
    await Promise.all([
      prisma.overtimeRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        include: { approvalSteps: true },
      }),
      prisma.officeExitRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        include: { approvalSteps: true },
      }),
      prisma.earlyLeaveRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        include: { approvalSteps: true },
      }),
      prisma.lateArrivalRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        include: { approvalSteps: true },
      }),
    ])

  const rows: (IzinHistoryRow & { sortAt: Date })[] = [
    ...overtimeRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "lembur",
        type: "Izin Lembur",
        date: formatDate(r.date),
        summary: r.task,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps, {
          isLembur: true,
          tahap2Done: r.status === "COMPLETED",
        }),
        canDelete:
          r.status === "PENDING_APPROVAL" &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...officeExitRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "meninggalkan_kantor",
        type: "Izin Meninggalkan Kantor",
        date: formatDate(r.createdAt),
        summary: `${OFFICE_EXIT_CATEGORY_LABEL[r.category]} — keluar pukul ${r.plannedExitTime}`,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        canDelete:
          r.status === "PENDING_APPROVAL" &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...earlyLeaveRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "pulang_cepat",
        type: "Izin Pulang Cepat",
        date: formatDate(r.createdAt),
        summary: `Pulang pukul ${r.plannedLeaveTime} — ${r.detail}`,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        canDelete:
          r.status === "PENDING_APPROVAL" &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...lateArrivalRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "terlambat",
        type: "Izin Terlambat",
        date: formatDate(r.createdAt),
        summary: r.reason,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        canDelete:
          r.status === "PENDING_APPROVAL" &&
          !r.arrivalConfirmedAt &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
  ]

  rows.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
  return rows.map(
    (row): IzinHistoryRow => ({
      id: row.id,
      publicId: row.publicId,
      kind: row.kind,
      type: row.type,
      date: row.date,
      summary: row.summary,
      status: row.status,
      stepLabel: row.stepLabel,
      canDelete: row.canDelete,
    })
  )
}
