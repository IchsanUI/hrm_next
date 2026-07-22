"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { buildRequestPublicId } from "@/lib/request-public-id"
import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import {
  ATTENDANCE_STATEMENT_ACKNOWLEDGEMENTS,
  MISSED_ATTENDANCE_TYPE_LABEL,
  attendanceStatementRejectionSchema,
  attendanceStatementRequestSchema,
} from "@/lib/validations/attendance-statement"

export type AttendanceStatementFormState = { error?: string } | undefined

function revalidateAttendanceStatementPaths() {
  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/riwayat-izin`)
    revalidatePath(`${prefix}/approval-center`)
  }
}

export async function createAttendanceStatementRequestAction(
  _prevState: AttendanceStatementFormState,
  formData: FormData
): Promise<AttendanceStatementFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const blockReason = await getIzinTypeBlockReason("IZIN_TIDAK_ABSEN")
  if (blockReason) {
    return { error: blockReason }
  }

  const parsed = attendanceStatementRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  // Checkbox HTML tidak muncul di FormData sama sekali kalau tidak dicentang
  // — dicek presence-nya langsung ("on"), bukan lewat zod (lihat komentar di
  // lib/validations/attendance-statement.ts).
  const unchecked = ATTENDANCE_STATEMENT_ACKNOWLEDGEMENTS.find(
    (a) => formData.get(a.field) !== "on"
  )
  if (unchecked) {
    return { error: "Semua pernyataan wajib dicentang sebelum mengajukan." }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: {
      id: true,
      fullName: true,
      reportsToId: true,
      department: { select: { headEmployeeId: true } },
    },
  })
  if (!employee) {
    return { error: "Data pegawai tidak ditemukan." }
  }

  const flow = await prisma.approvalFlow.findUnique({
    where: { leaveType: "IZIN_TIDAK_ABSEN" },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  const steps =
    flow && flow.steps.length > 0
      ? flow.steps
      : [{ approverType: "ATASAN_LANGSUNG" as const, approverEmployeeId: null }]

  const resolvedSteps: {
    order: number
    approverType: (typeof steps)[number]["approverType"]
    approverId: number | null
    status: "WAITING" | "IN_PROGRESS" | "SKIPPED"
    notes: string | null
  }[] = steps.map((step, index) => {
    const candidate =
      step.approverType === "ATASAN_LANGSUNG"
        ? employee.reportsToId
        : step.approverType === "KEPALA_DEPARTEMEN"
          ? employee.department.headEmployeeId
          : step.approverType === "DIREKSI" || step.approverType === "PEGAWAI_TERTENTU"
            ? step.approverEmployeeId
            : null // HR / PEGAWAI_PENGGANTI belum diaktifkan di runtime

    if (!candidate) {
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: null as number | null,
        status: "SKIPPED" as const,
        notes: "Dilewati — tidak ada approver yang bisa ditentukan untuk tipe step ini.",
      }
    }
    if (candidate === employee.id) {
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: null as number | null,
        status: "SKIPPED" as const,
        notes: "Dilewati — pemohon adalah pejabat step ini.",
      }
    }
    return {
      order: index + 1,
      approverType: step.approverType,
      approverId: candidate,
      status: "WAITING" as const,
      notes: null as string | null,
    }
  })

  const firstActiveIndex = resolvedSteps.findIndex((s) => s.status === "WAITING")
  if (firstActiveIndex === -1) {
    return {
      error:
        "Tidak ada approver yang bisa ditentukan untuk pengajuan ini. Hubungi HR/Admin untuk mengatur alur approval Izin Tidak Absen — direkomendasikan Atasan Langsung lalu Direksi.",
    }
  }
  resolvedSteps[firstActiveIndex] = { ...resolvedSteps[firstActiveIndex], status: "IN_PROGRESS" }
  const approverId = resolvedSteps[firstActiveIndex].approverId as number

  const typeLabel = MISSED_ATTENDANCE_TYPE_LABEL[parsed.data.missedType]

  const request = await prisma.$transaction(async (tx) => {
    const sequence = (await tx.attendanceStatementRequest.count()) + 1
    const created = await tx.attendanceStatementRequest.create({
      data: {
        publicId: buildRequestPublicId("PA", sequence),
        employeeId: employee.id,
        date: new Date(parsed.data.date),
        missedType: parsed.data.missedType,
        reason: parsed.data.reason,
        acknowledgeNotAbsent: true,
        acknowledgeConsequence: true,
        acknowledgeNoRepeat: true,
        approverId,
      },
    })
    await tx.attendanceStatementApprovalStep.createMany({
      data: resolvedSteps.map((s) => ({
        requestId: created.id,
        order: s.order,
        approverType: s.approverType,
        approverId: s.approverId,
        status: s.status,
        notes: s.notes,
      })),
    })
    return created
  })

  const approverEmployee = await prisma.employee.findUnique({
    where: { id: approverId },
    select: { user: { select: { id: true } } },
  })
  if (approverEmployee?.user?.id) {
    await createNotification({
      userId: approverEmployee.user.id,
      title: "Pernyataan Tidak Absen Baru",
      message: `${employee.fullName} mengajukan pernyataan ${typeLabel.toLowerCase()}.`,
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "AttendanceStatementRequest",
    description: `${session.user.username} mengajukan pernyataan tidak absen (${request.id}): ${typeLabel}.`,
  })

  revalidateAttendanceStatementPaths()
  redirect(`/pegawai/riwayat-izin/tidak-absen/${request.publicId}`)
}

export async function approveAttendanceStatementRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.attendanceStatementRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.attendanceStatementApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.attendanceStatementApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "APPROVED", actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  const nextStep = await prisma.attendanceStatementApprovalStep.findFirst({
    where: { requestId, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStep && nextStep.approverId) {
    await prisma.$transaction([
      prisma.attendanceStatementApprovalStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.attendanceStatementRequest.update({
        where: { id: requestId },
        data: { approverId: nextStep.approverId },
      }),
    ])

    const nextApproverEmployee = await prisma.employee.findUnique({
      where: { id: nextStep.approverId },
      select: { user: { select: { id: true } } },
    })
    if (nextApproverEmployee?.user?.id) {
      await createNotification({
        userId: nextApproverEmployee.user.id,
        title: "Pernyataan Tidak Absen Baru",
        message: `${request.employee.fullName} mengajukan pernyataan tidak absen — perlu persetujuan Anda.`,
        link: "/admin/approval-center",
      })
    }
  } else {
    const { count: finalUpdated } = await prisma.attendanceStatementRequest.updateMany({
      where: { id: requestId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedAt: new Date() },
    })
    if (finalUpdated === 0) {
      return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
    }

    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Pernyataan Tidak Absen Disetujui",
        message: "Pernyataan tidak absen Anda telah disetujui.",
        link: `/pegawai/riwayat-izin/tidak-absen/${request.publicId}`,
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "AttendanceStatementRequest",
    description: `${session.user.username} menyetujui pernyataan tidak absen (${requestId}) milik "${request.employee.fullName}".`,
  })

  revalidateAttendanceStatementPaths()
  return undefined
}

export async function rejectAttendanceStatementRequestAction(
  requestId: number,
  _prevState: AttendanceStatementFormState,
  formData: FormData
): Promise<AttendanceStatementFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = attendanceStatementRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }

  const request = await prisma.attendanceStatementRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.attendanceStatementApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.attendanceStatementApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REJECTED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  await prisma.attendanceStatementApprovalStep.updateMany({
    where: { requestId, status: "WAITING" },
    data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak di step sebelumnya." },
  })

  const { count: finalUpdated } = await prisma.attendanceStatementRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason },
  })
  if (finalUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Pernyataan Tidak Absen Ditolak",
      message: `Pernyataan tidak absen Anda ditolak. Alasan: ${parsed.data.rejectionReason}`,
      link: `/pegawai/riwayat-izin/tidak-absen/${request.publicId}`,
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "AttendanceStatementRequest",
    description: `${session.user.username} menolak pernyataan tidak absen (${requestId}) milik "${request.employee.fullName}". Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateAttendanceStatementPaths()
  return undefined
}

export async function deleteAttendanceStatementRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    throw new Error("Akun Anda tidak terhubung ke data pegawai.")
  }

  const request = await prisma.attendanceStatementRequest.findUnique({
    where: { id: requestId },
    include: { approvalSteps: true },
  })
  if (!request) {
    throw new Error("Pengajuan tidak ditemukan.")
  }
  if (request.employeeId !== session.user.employeeId) {
    throw new Error("Anda tidak berhak menghapus pengajuan ini.")
  }
  if (request.status !== "PENDING_APPROVAL") {
    throw new Error("Pengajuan ini sudah diproses dan tidak bisa dihapus.")
  }
  const alreadyApproved = request.approvalSteps.some((s) => s.status === "APPROVED")
  if (alreadyApproved) {
    throw new Error("Pengajuan ini sudah disetujui salah satu approver dan tidak bisa dihapus.")
  }

  await prisma.attendanceStatementRequest.delete({ where: { id: requestId } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "AttendanceStatementRequest",
    description: `${session.user.username} menghapus pernyataan tidak absen (${requestId}).`,
  })

  revalidateAttendanceStatementPaths()
}
