import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { getHolidayExclusionSet } from "@/lib/leave-balance"
import { countWorkingDays } from "@/lib/working-days"
import { cutiDurationDays } from "@/lib/validations/cuti"
import { Breadcrumb } from "@/components/breadcrumb"
import {
  CutiDetailContent,
  type CutiDetailData,
} from "@/components/cuti-detail-content"
import type { ApprovalStepRow } from "@/components/approval-timeline"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function AdminCutiDetailPage({
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

  const request = await prisma.cutiRequest.findUnique({
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

  const excludedDates = await getHolidayExclusionSet(
    request.startDate.getUTCFullYear(),
    request.endDate.getUTCFullYear()
  )

  const data: CutiDetailData = {
    id: request.id,
    publicId: request.publicId,
    applicant: request.employee.fullName,
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    durationDays: cutiDurationDays(isoDate(request.startDate), isoDate(request.endDate)),
    workingDays: countWorkingDays(request.startDate, request.endDate, excludedDates),
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
          { label: `Cuti ${request.publicId}` },
        ]}
      />
      <CutiDetailContent
        data={data}
        basePath="/admin"
        substituteColleagues={substituteColleagues}
      />
    </div>
  )
}
