import { prisma } from "@/lib/prisma"
import { DISPENSATION_CATEGORY_LABEL } from "@/lib/validations/dispensation"
import { IZIN_MONITORING_KIND_OPTIONS, type IzinMonitoringRow } from "@/lib/izin-monitoring-constants"

// Re-export supaya konsumen server-side (page/route yang sudah ada) tidak
// perlu ganti sumber impor — lihat lib/izin-monitoring-constants.ts buat
// alasan kenapa tipe & konstanta dipisah dari fungsi query di file ini.
export { IZIN_MONITORING_KIND_OPTIONS, type IzinMonitoringRow }

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

export const OFFICE_EXIT_CATEGORY_LABEL: Record<string, string> = {
  PRIBADI: "Urusan Pribadi",
  DINAS: "Urusan Dinas",
}

type EmployeeInfo = {
  employee: { fullName: string; employeeNumber: string; department: { name: string } }
}

function employeeFields(r: EmployeeInfo) {
  return {
    employeeName: r.employee.fullName,
    employeeNumber: r.employee.employeeNumber,
    departmentName: r.employee.department.name,
  }
}

// Org-wide, lintas semua pegawai — beda dari getIzinHistoryRows di
// lib/izin-history.ts yang cuma buat satu pegawai (dipakai di Riwayat Izin).
// Dipakai buat Monitoring Izin (tabel di layar) dan laporan Excel-nya
// (lib/reports/izin-monitoring-report.ts) — filter tanggal berdasarkan
// createdAt (tanggal pengajuan), bukan tanggal mulai izinnya.
export async function getIzinMonitoringRows(filters: {
  startDate: Date
  endDate: Date
  kind?: IzinMonitoringRow["kind"]
}): Promise<IzinMonitoringRow[]> {
  const dateWhere = { createdAt: { gte: filters.startDate, lte: filters.endDate } }
  const employeeInclude = {
    employee: {
      select: { fullName: true, employeeNumber: true, department: { select: { name: true } } },
    },
  }

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
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.officeExitRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.earlyLeaveRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.lateArrivalRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.sickLeaveRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.cutiRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.maternityLeaveRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.specialLeaveRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.dispensationRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.cutiBesarRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
    prisma.unpaidLeaveRequest.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      include: employeeInclude,
    }),
  ])

  const rows: IzinMonitoringRow[] = [
    ...overtimeRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "lembur",
        type: "Izin Lembur",
        ...employeeFields(r),
        date: formatDate(r.date),
        requestedAt: r.createdAt,
        summary: r.task,
        status: r.status,
        pendingSecondaryStep: r.status === "APPROVED",
      })
    ),
    ...officeExitRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "meninggalkan_kantor",
        type: "Izin Meninggalkan Kantor",
        ...employeeFields(r),
        date: formatDate(r.createdAt),
        requestedAt: r.createdAt,
        summary: `${OFFICE_EXIT_CATEGORY_LABEL[r.category]} — keluar pukul ${r.plannedExitTime}`,
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...earlyLeaveRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "pulang_cepat",
        type: "Izin Pulang Cepat",
        ...employeeFields(r),
        date: formatDate(r.createdAt),
        requestedAt: r.createdAt,
        summary: `Pulang pukul ${r.plannedLeaveTime} — ${r.detail}`,
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...lateArrivalRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "terlambat",
        type: "Izin Terlambat",
        ...employeeFields(r),
        date: formatDate(r.createdAt),
        requestedAt: r.createdAt,
        summary: r.reason,
        status: r.status,
        pendingSecondaryStep: r.status === "APPROVED" && !r.arrivalConfirmedAt,
      })
    ),
    ...sickLeaveRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "sakit",
        type: "Izin Sakit",
        ...employeeFields(r),
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        requestedAt: r.createdAt,
        summary: r.reason,
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...cutiRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti",
        type: "Izin Cuti",
        ...employeeFields(r),
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        requestedAt: r.createdAt,
        summary: r.reason,
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...maternityLeaveRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_bersalin",
        type: r.type === "BERSALIN" ? "Cuti Bersalin" : "Cuti Gugur Kandungan",
        ...employeeFields(r),
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        requestedAt: r.createdAt,
        summary: r.reason ?? "-",
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...specialLeaveRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_khusus",
        type: r.type === "HAJI" ? "Cuti Khusus Haji" : "Cuti Khusus Umroh",
        ...employeeFields(r),
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        requestedAt: r.createdAt,
        summary: r.reason ?? "-",
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...dispensationRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "dispensasi",
        type: "Dispensasi",
        ...employeeFields(r),
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        requestedAt: r.createdAt,
        summary: `${DISPENSATION_CATEGORY_LABEL[r.category]} — ${r.reason}`,
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...cutiBesarRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_besar",
        type: "Cuti Besar",
        ...employeeFields(r),
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        requestedAt: r.createdAt,
        summary: r.reason ?? "-",
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
    ...unpaidLeaveRequests.map(
      (r): IzinMonitoringRow => ({
        id: r.id,
        publicId: r.publicId,
        kind: "cuti_diluar_tanggungan",
        type: "Cuti Di Luar Tanggungan",
        ...employeeFields(r),
        date: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
        requestedAt: r.createdAt,
        summary: r.reason,
        status: r.status,
        pendingSecondaryStep: false,
      })
    ),
  ]

  const filtered = filters.kind ? rows.filter((r) => r.kind === filters.kind) : rows
  filtered.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
  return filtered
}
