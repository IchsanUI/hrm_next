import { notFound } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import {
  SickLeaveDetailContent,
  type SickLeaveDetailData,
} from "@/components/sick-leave-detail-content"
import type { ApprovalStepRow } from "@/components/approval-timeline"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

export default async function PegawaiSickLeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: publicId } = await params

  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) {
    notFound()
  }

  const request = await prisma.sickLeaveRequest.findUnique({
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

  const data: SickLeaveDetailData = {
    id: request.id,
    publicId: request.publicId,
    applicant: request.employee.fullName,
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    reason: request.reason,
    substituteEmployeeName: request.substituteEmployeeName,
    medicalCertificateUrl: request.medicalCertificateUrl,
    medicalCertificateUploadedAt: request.medicalCertificateUploadedAt
      ? formatDateTime(request.medicalCertificateUploadedAt)
      : null,
    status: request.status,
    rejectionReason: request.rejectionReason,
    approvedAt: request.approvedAt ? formatDateTime(request.approvedAt) : null,
    createdAt: formatDateTime(request.createdAt),
    isOwner,
    steps,
  }

  return (
    <SickLeaveDetailContent
      data={data}
      basePath="/pegawai"
      substituteColleagues={substituteColleagues}
    />
  )
}
