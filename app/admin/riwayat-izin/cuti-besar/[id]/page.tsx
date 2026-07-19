import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { tenureYears, isCutiBesarLate, CUTI_BESAR_MAX_INSTALLMENTS } from "@/lib/validations/cuti-besar"
import { Breadcrumb } from "@/components/breadcrumb"
import {
  CutiBesarDetailContent,
  type CutiBesarDetailData,
} from "@/components/cuti-besar-detail-content"
import type { ApprovalStepRow } from "@/components/approval-timeline"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

function totalDaysBetween(startDate: Date, endDate: Date) {
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export default async function AdminCutiBesarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: publicId } = await params

  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) {
    redirect("/admin/dashboard")
  }

  const request = await prisma.cutiBesarRequest.findUnique({
    where: { publicId },
    include: {
      employee: { select: { fullName: true, departmentId: true, startDate: true } },
      approvalSteps: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { approverEmployee: { select: { fullName: true } } },
      },
    },
  })
  if (!request) {
    notFound()
  }

  // Nomor urut pengajuan (ke-1/ke-2/dst) dihitung dari berapa banyak
  // pengajuan lain (bukan REJECTED) milik pegawai ini yang lebih dulu ada.
  const priorCount = await prisma.cutiBesarRequest.count({
    where: {
      employeeId: request.employeeId,
      status: { in: ["PENDING_APPROVAL", "REVISI", "APPROVED"] },
      id: { lt: request.id },
    },
  })
  const installmentNumber = priorCount + 1
  const isLate =
    installmentNumber <= CUTI_BESAR_MAX_INSTALLMENTS &&
    isCutiBesarLate(
      installmentNumber as 1 | 2,
      tenureYears(request.employee.startDate, request.startDate)
    )

  const isOwner = request.employeeId === employeeId
  const isApprover = request.approvalSteps.some((s) => s.approverId === employeeId)
  if (!isOwner && !isApprover) {
    notFound()
  }

  const steps: ApprovalStepRow[] = request.approvalSteps.map((s) => ({
    id: s.id,
    order: s.order,
    approverType: s.approverType,
    approverName: s.approverEmployee?.fullName ?? null,
    status: s.status,
    notes: s.notes,
    actedAt: s.actedAt ? formatDateTime(s.actedAt) : null,
  }))

  const substituteColleagues =
    isOwner && request.status === "REVISI"
      ? (
          await getDepartmentColleagues(request.employeeId, request.employee.departmentId)
        ).filter((c) => c.id !== request.substituteEmployeeId)
      : []

  const data: CutiBesarDetailData = {
    id: request.id,
    publicId: request.publicId,
    applicant: request.employee.fullName,
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    totalDays: totalDaysBetween(request.startDate, request.endDate),
    isException: request.isException,
    installmentNumber,
    isLate,
    reason: request.reason,
    substituteEmployeeName: request.substituteEmployeeName,
    supportingDocumentUrl: request.supportingDocumentUrl,
    status: request.status,
    rejectionReason: request.rejectionReason,
    approvedAt: request.approvedAt ? formatDateTime(request.approvedAt) : null,
    createdAt: formatDateTime(request.createdAt),
    isOwner,
    steps,
  }

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Riwayat Izin", href: "/admin/riwayat-izin" },
          { label: `Cuti Besar ${request.publicId}` },
        ]}
      />
      <CutiBesarDetailContent
        data={data}
        basePath="/admin"
        substituteColleagues={substituteColleagues}
      />
    </div>
  )
}
