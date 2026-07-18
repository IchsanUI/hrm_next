"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { buildRequestPublicId } from "@/lib/request-public-id"
import {
  earlyLeaveRequestSchema,
  earlyLeaveRejectionSchema,
} from "@/lib/validations/early-leave"

export type EarlyLeaveFormState = { error?: string } | undefined

function revalidateEarlyLeavePaths() {
  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/riwayat-izin`)
    revalidatePath(`${prefix}/approval-center`)
  }
}

export async function createEarlyLeaveRequestAction(
  _prevState: EarlyLeaveFormState,
  formData: FormData
): Promise<EarlyLeaveFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = earlyLeaveRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
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
    where: { leaveType: "IZIN_PULANG_CEPAT" },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  const steps =
    flow && flow.steps.length > 0
      ? flow.steps
      : [{ approverType: "ATASAN_LANGSUNG" as const, approverEmployeeId: null, unlockAfter: false }]

  // Resolusi generik — persis pola Izin Lembur: ATASAN_LANGSUNG/KEPALA_DEPARTEMEN
  // auto-skip kalau pemohon sendiri pejabatnya, DIREKSI/PEGAWAI_TERTENTU selalu
  // jalan ke approver tetap. `unlockAfter` disalin apa adanya dari konfigurasi
  // alur ke tiap baris step, dipakai nanti saat approve.
  const resolvedSteps: {
    order: number
    approverType: (typeof steps)[number]["approverType"]
    approverId: number | null
    unlockAfter: boolean
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
        unlockAfter: step.unlockAfter,
        status: "SKIPPED" as const,
        notes: "Dilewati — tidak ada approver yang bisa ditentukan untuk tipe step ini.",
      }
    }
    if (candidate === employee.id) {
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: null as number | null,
        unlockAfter: step.unlockAfter,
        status: "SKIPPED" as const,
        notes: "Dilewati — pemohon adalah pejabat step ini.",
      }
    }
    return {
      order: index + 1,
      approverType: step.approverType,
      approverId: candidate,
      unlockAfter: step.unlockAfter,
      status: "WAITING" as const,
      notes: null as string | null,
    }
  })

  const firstActiveIndex = resolvedSteps.findIndex((s) => s.status === "WAITING")
  if (firstActiveIndex === -1) {
    return {
      error:
        "Tidak ada approver yang bisa ditentukan untuk pengajuan ini. Hubungi HR/Admin untuk mengatur alur approval Izin Pulang Cepat.",
    }
  }
  resolvedSteps[firstActiveIndex] = { ...resolvedSteps[firstActiveIndex], status: "IN_PROGRESS" }
  const approverId = resolvedSteps[firstActiveIndex].approverId as number

  const request = await prisma.$transaction(async (tx) => {
    const sequence = (await tx.earlyLeaveRequest.count()) + 1
    const created = await tx.earlyLeaveRequest.create({
      data: {
        publicId: buildRequestPublicId("PC", sequence),
        employeeId: employee.id,
        plannedLeaveTime: parsed.data.plannedLeaveTime,
        detail: parsed.data.detail,
        approverId,
      },
    })
    await tx.earlyLeaveApprovalStep.createMany({
      data: resolvedSteps.map((s) => ({
        requestId: created.id,
        order: s.order,
        approverType: s.approverType,
        approverId: s.approverId,
        unlockAfter: s.unlockAfter,
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
      title: "Pengajuan Izin Pulang Cepat Baru",
      message: `${employee.fullName} mengajukan izin pulang cepat pukul ${parsed.data.plannedLeaveTime}.`,
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "EarlyLeaveRequest",
    description: `${session.user.username} mengajukan izin pulang cepat (${request.id}) pukul ${parsed.data.plannedLeaveTime}.`,
  })

  revalidateEarlyLeavePaths()
  redirect("/pegawai/riwayat-izin?toast=early-leave-submitted")
}

export async function approveEarlyLeaveRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.earlyLeaveRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.earlyLeaveApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.earlyLeaveApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "APPROVED", actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  // Step ini yang membuka boleh-pulang-cepat — distempel saat itu juga,
  // terlepas apakah alur masih lanjut ke step berikutnya atau tidak.
  if (currentStep.unlockAfter && !request.actionUnlockedAt) {
    await prisma.earlyLeaveRequest.update({
      where: { id: requestId },
      data: { actionUnlockedAt: new Date() },
    })
    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Boleh Pulang Cepat",
        message: `Pengajuan izin pulang cepat Anda pukul ${request.plannedLeaveTime} sudah disetujui Kepala Departemen. Anda sudah diperbolehkan pulang cepat.`,
        link: "/pegawai/riwayat-izin",
      })
    }
  }

  const nextStep = await prisma.earlyLeaveApprovalStep.findFirst({
    where: { requestId, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStep && nextStep.approverId) {
    await prisma.$transaction([
      prisma.earlyLeaveApprovalStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.earlyLeaveRequest.update({
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
        title: "Pengajuan Izin Pulang Cepat Baru",
        message: `${request.employee.fullName} mengajukan izin pulang cepat pukul ${request.plannedLeaveTime}.`,
        link: "/admin/approval-center",
      })
    }
  } else {
    const now = new Date()
    const { count: finalUpdated } = await prisma.earlyLeaveRequest.updateMany({
      where: { id: requestId, status: "PENDING_APPROVAL" },
      data: {
        status: "APPROVED",
        approvedAt: now,
        // Fallback kalau tidak ada satupun step unlockAfter yang sempat aktif
        // (mis. karena di-skip) — begitu pengajuan disetujui penuh, pegawai
        // pasti sudah boleh pulang cepat, walau belum pernah distempel sebelumnya.
        ...(request.actionUnlockedAt ? {} : { actionUnlockedAt: now }),
      },
    })
    if (finalUpdated === 0) {
      return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
    }

    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Izin Pulang Cepat Disetujui",
        message: `Pengajuan izin pulang cepat Anda pukul ${request.plannedLeaveTime} telah disetujui sepenuhnya.`,
        link: "/pegawai/riwayat-izin",
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "EarlyLeaveRequest",
    description: `${session.user.username} menyetujui izin pulang cepat (${requestId}) milik "${request.employee.fullName}".`,
  })

  revalidateEarlyLeavePaths()
  return undefined
}

export async function rejectEarlyLeaveRequestAction(
  requestId: number,
  _prevState: EarlyLeaveFormState,
  formData: FormData
): Promise<EarlyLeaveFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = earlyLeaveRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }

  const request = await prisma.earlyLeaveRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.earlyLeaveApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.earlyLeaveApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REJECTED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  await prisma.earlyLeaveApprovalStep.updateMany({
    where: { requestId, status: "WAITING" },
    data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak di step sebelumnya." },
  })

  const { count: finalUpdated } = await prisma.earlyLeaveRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason },
  })
  if (finalUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Izin Pulang Cepat Ditolak",
      message: `Pengajuan izin pulang cepat Anda pukul ${request.plannedLeaveTime} ditolak. Alasan: ${parsed.data.rejectionReason}`,
      link: "/pegawai/riwayat-izin",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "EarlyLeaveRequest",
    description: `${session.user.username} menolak izin pulang cepat (${requestId}) milik "${request.employee.fullName}". Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateEarlyLeavePaths()
  return undefined
}

export async function deleteEarlyLeaveRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    throw new Error("Akun Anda tidak terhubung ke data pegawai.")
  }

  const request = await prisma.earlyLeaveRequest.findUnique({
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
    throw new Error(
      "Pengajuan ini sudah disetujui salah satu approver dan tidak bisa dihapus."
    )
  }

  await prisma.earlyLeaveRequest.delete({ where: { id: requestId } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "EarlyLeaveRequest",
    description: `${session.user.username} menghapus pengajuan izin pulang cepat (${requestId}).`,
  })

  revalidateEarlyLeavePaths()
}
