import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { computeMaternityLeaveBreakdown } from "@/lib/validations/maternity-leave"
import { Breadcrumb } from "@/components/breadcrumb"
import {
  MaternityLeaveDetailContent,
  type MaternityLeaveDetailData,
} from "@/components/maternity-leave-detail-content"
import type { ApprovalStepRow } from "@/components/approval-timeline"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

function formatIsoDate(iso: string) {
  return formatDate(new Date(`${iso}T00:00:00.000Z`))
}

function totalDaysBetween(startDate: Date, endDate: Date) {
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function AdminMaternityLeaveDetailPage({
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

  const request = await prisma.maternityLeaveRequest.findUnique({
    where: { publicId },
    include: {
      employee: { select: { fullName: true, departmentId: true } },
      approvalSteps: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { approverEmployee: { select: { fullName: true } } },
      },
    },
  })
  if (!request) {
    notFound()
  }

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

  const breakdown = computeMaternityLeaveBreakdown(request.type, isoDate(request.referenceDate))

  const data: MaternityLeaveDetailData = {
    id: request.id,
    publicId: request.publicId,
    applicant: request.employee.fullName,
    type: request.type,
    referenceDate: formatDate(request.referenceDate),
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    beforeRangeStart: breakdown.beforeRangeStart ? formatIsoDate(breakdown.beforeRangeStart) : null,
    beforeRangeEnd: breakdown.beforeRangeEnd ? formatIsoDate(breakdown.beforeRangeEnd) : null,
    afterRangeStart: formatIsoDate(breakdown.afterRangeStart),
    afterRangeEnd: formatIsoDate(breakdown.afterRangeEnd),
    totalDays: totalDaysBetween(request.startDate, request.endDate),
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
          { label: `Cuti Bersalin ${request.publicId}` },
        ]}
      />
      <MaternityLeaveDetailContent
        data={data}
        basePath="/admin"
        substituteColleagues={substituteColleagues}
      />
    </div>
  )
}
