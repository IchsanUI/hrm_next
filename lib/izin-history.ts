import { prisma } from "@/lib/prisma"
import type { IzinHistoryRow } from "@/components/riwayat-izin-content"
import { DISPENSATION_CATEGORY_LABEL } from "@/lib/validations/dispensation"

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
  options?: {
    isLembur?: boolean
    tahap2Done?: boolean
    // Izin Terlambat: approval bisa selesai duluan sebelum pegawai beneran
    // sampai kantor — arrivalConfirmed dipisah dari status approval, sama
    // konsepnya kayak Tahap 2 Lembur.
    isTerlambat?: boolean
    arrivalConfirmed?: boolean
  }
) {
  const relevantSteps = approvalSteps.filter((s) => s.status !== "SKIPPED")
  const total = relevantSteps.length

  if (status === "REJECTED") {
    const rejectedIndex = relevantSteps.findIndex((s) => s.status === "REJECTED")
    return rejectedIndex === -1 ? "Ditolak" : `Ditolak di Step ${rejectedIndex + 1}`
  }

  if (status === "REVISI") {
    return "Menunggu Pengganti Baru"
  }

  if (status === "PENDING_APPROVAL") {
    const activeIndex = relevantSteps.findIndex((s) => s.status === "IN_PROGRESS")
    return activeIndex === -1 ? "-" : `Step ${activeIndex + 1} dari ${total}`
  }

  // Approval sudah tuntas (APPROVED/COMPLETED).
  if (options?.isLembur) {
    return options.tahap2Done ? "Selesai" : "Menunggu Tahap 2"
  }
  if (options?.isTerlambat) {
    return options.arrivalConfirmed ? "Selesai" : "Belum Konfirmasi"
  }
  return "Selesai"
}

export async function getIzinHistoryRows(
  employeeId: number | null | undefined,
  filters?: { startDate?: Date; endDate?: Date; kind?: IzinHistoryRow["kind"] }
): Promise<IzinHistoryRow[]> {
  if (!employeeId) return []

  const dateWhere =
    filters?.startDate && filters?.endDate
      ? { createdAt: { gte: filters.startDate, lte: filters.endDate } }
      : {}

  const [
    overtimeRequests,
    officeExitRequests,
    earlyLeaveRequests,
    lateArrivalRequests,
    sickLeaveRequests,
    cutiRequests,
    maternityLeaveRequests,
    specialLeaveRequests,
    dispensationRequests,
    cutiBesarRequests,
    unpaidLeaveRequests,
  ] = await Promise.all([
    prisma.overtimeRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.officeExitRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.earlyLeaveRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.lateArrivalRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.sickLeaveRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.cutiRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.maternityLeaveRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.specialLeaveRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.dispensationRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.cutiBesarRequest.findMany({
      where: { employeeId, ...dateWhere },
      orderBy: { createdAt: "desc" },
      include: { approvalSteps: true },
    }),
    prisma.unpaidLeaveRequest.findMany({
      where: { employeeId, ...dateWhere },
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
        pendingSecondaryStep: r.status === "APPROVED",
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
        pendingSecondaryStep: false,
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
        pendingSecondaryStep: false,
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
        stepLabel: computeStepLabel(r.status, r.approvalSteps, {
          isTerlambat: true,
          arrivalConfirmed: Boolean(r.arrivalConfirmedAt),
        }),
        pendingSecondaryStep: r.status === "APPROVED" && !r.arrivalConfirmedAt,
        canDelete:
          r.status === "PENDING_APPROVAL" &&
          !r.arrivalConfirmedAt &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...sickLeaveRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "sakit",
        type: "Izin Sakit",
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        summary: r.reason,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        pendingSecondaryStep: false,
        canDelete:
          (r.status === "PENDING_APPROVAL" || r.status === "REVISI") &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...cutiRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti",
        type: "Izin Cuti",
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        summary: r.reason,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        pendingSecondaryStep: false,
        canDelete:
          (r.status === "PENDING_APPROVAL" || r.status === "REVISI") &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...maternityLeaveRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_bersalin",
        type: r.type === "BERSALIN" ? "Cuti Bersalin" : "Cuti Gugur Kandungan",
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        summary: r.reason ?? "-",
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        pendingSecondaryStep: false,
        canDelete:
          (r.status === "PENDING_APPROVAL" || r.status === "REVISI") &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...specialLeaveRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_khusus",
        type: r.type === "HAJI" ? "Cuti Khusus Haji" : "Cuti Khusus Umroh",
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        summary: r.reason ?? "-",
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        pendingSecondaryStep: false,
        canDelete:
          (r.status === "PENDING_APPROVAL" || r.status === "REVISI") &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...dispensationRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "dispensasi",
        type: "Dispensasi",
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        summary: `${DISPENSATION_CATEGORY_LABEL[r.category]} — ${r.reason}`,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        pendingSecondaryStep: false,
        canDelete:
          (r.status === "PENDING_APPROVAL" || r.status === "REVISI") &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...cutiBesarRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_besar",
        type: "Cuti Besar",
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        summary: r.reason ?? "-",
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        pendingSecondaryStep: false,
        canDelete:
          (r.status === "PENDING_APPROVAL" || r.status === "REVISI") &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
    ...unpaidLeaveRequests.map(
      (r): IzinHistoryRow & { sortAt: Date } => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_diluar_tanggungan",
        type: "Cuti Di Luar Tanggungan",
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        summary: r.reason,
        status: r.status,
        stepLabel: computeStepLabel(r.status, r.approvalSteps),
        pendingSecondaryStep: false,
        canDelete:
          (r.status === "PENDING_APPROVAL" || r.status === "REVISI") &&
          !r.approvalSteps.some((s) => s.status === "APPROVED"),
        sortAt: r.createdAt,
      })
    ),
  ]

  rows.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
  const filteredRows = filters?.kind ? rows.filter((r) => r.kind === filters.kind) : rows
  return filteredRows.map(
    (row): IzinHistoryRow => ({
      id: row.id,
      publicId: row.publicId,
      kind: row.kind,
      type: row.type,
      date: row.date,
      summary: row.summary,
      status: row.status,
      stepLabel: row.stepLabel,
      pendingSecondaryStep: row.pendingSecondaryStep,
      canDelete: row.canDelete,
    })
  )
}
