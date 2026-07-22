import { notFound } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  AttendanceStatementDetailContent,
  type AttendanceStatementDetailData,
} from "@/components/attendance-statement-detail-content"
import { MISSED_ATTENDANCE_TYPE_LABEL } from "@/lib/validations/attendance-statement"
import type { ApprovalStepRow } from "@/components/approval-timeline"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

export default async function PegawaiAttendanceStatementDetailPage({
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

  const request = await prisma.attendanceStatementRequest.findUnique({
    where: { publicId },
    include: {
      employee: { select: { fullName: true } },
      approvalSteps: {
        orderBy: { order: "asc" },
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

  const data: AttendanceStatementDetailData = {
    id: request.id,
    publicId: request.publicId,
    applicant: request.employee.fullName,
    date: formatDate(request.date),
    missedTypeLabel: MISSED_ATTENDANCE_TYPE_LABEL[request.missedType],
    reason: request.reason,
    status: request.status,
    rejectionReason: request.rejectionReason,
    createdAt: formatDateTime(request.createdAt),
    steps,
  }

  return <AttendanceStatementDetailContent data={data} basePath="/pegawai" />
}
