import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canSelfConfirmArrival } from "@/lib/late-arrival-cutoff"
import { Breadcrumb } from "@/components/breadcrumb"
import {
  LateArrivalDetailContent,
  type LateArrivalDetailData,
} from "@/components/late-arrival-detail-content"
import type { ApprovalStepRow } from "@/components/approval-timeline"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

export default async function AdminLateArrivalDetailPage({
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

  const request = await prisma.lateArrivalRequest.findUnique({
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

  const data: LateArrivalDetailData = {
    id: request.id,
    publicId: request.publicId,
    applicant: request.employee.fullName,
    reason: request.reason,
    evidenceUrl: request.evidenceUrl,
    status: request.status,
    rejectionReason: request.rejectionReason,
    arrivalConfirmedAt: request.arrivalConfirmedAt
      ? formatDateTime(request.arrivalConfirmedAt)
      : null,
    arrivalLocationLabel: request.arrivalLocationLabel,
    arrivalConfirmedByAdmin: request.arrivalConfirmedByAdmin,
    arrivalConfirmedByAdminAt: request.arrivalConfirmedByAdminAt
      ? formatDateTime(request.arrivalConfirmedByAdminAt)
      : null,
    createdAt: formatDateTime(request.createdAt),
    locationLabel: request.locationLabel,
    locationLat: request.locationLat,
    locationLng: request.locationLng,
    arrivalLat: request.arrivalLat,
    arrivalLng: request.arrivalLng,
    isOwner,
    canSelfConfirm: canSelfConfirmArrival(request.createdAt),
    steps,
  }

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Riwayat Izin", href: "/admin/riwayat-izin" },
          { label: `Terlambat ${request.publicId}` },
        ]}
      />
      <LateArrivalDetailContent data={data} basePath="/admin" />
    </div>
  )
}
