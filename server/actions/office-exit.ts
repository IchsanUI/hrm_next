"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { buildRequestPublicId } from "@/lib/request-public-id"
import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { findInvalidApproverIds } from "@/lib/approval-flow-guard"
import {
  officeExitRequestSchema,
  officeExitRejectionSchema,
} from "@/lib/validations/office-exit"

export type OfficeExitFormState = { error?: string } | undefined

function revalidateOfficeExitPaths() {
  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/riwayat-izin`)
    revalidatePath(`${prefix}/approval-center`)
  }
}

export async function createOfficeExitRequestAction(
  _prevState: OfficeExitFormState,
  formData: FormData
): Promise<OfficeExitFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const blockReason = await getIzinTypeBlockReason("IZIN_MENINGGALKAN_KANTOR", session.user.employeeId)
  if (blockReason) {
    return { error: blockReason }
  }

  const parsed = officeExitRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: {
      id: true,
      fullName: true,
      department: { select: { headEmployeeId: true } },
    },
  })
  if (!employee) {
    return { error: "Data pegawai tidak ditemukan." }
  }

  const flow = await prisma.approvalFlow.findUnique({
    where: { leaveType: "IZIN_MENINGGALKAN_KANTOR" },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  const steps =
    flow && flow.steps.length > 0
      ? flow.steps
      : [{ approverType: "KEPALA_DEPARTEMEN" as const, approverEmployeeId: null }]

  const isDeptHead = employee.department.headEmployeeId === employee.id

  // Alur asimetris: Kepala Departemen dilewati kalau pemohon sendiri kepala
  // departemen (tidak bisa approve pengajuan sendiri). Direksi SEBALIKNYA —
  // cuma aktif kalau pemohon adalah Kepala Departemen; pegawai biasa tidak
  // pernah perlu approval Direksi untuk izin ini.
  const resolvedSteps: {
    order: number
    approverType: (typeof steps)[number]["approverType"]
    approverId: number | null
    status: "WAITING" | "IN_PROGRESS" | "SKIPPED"
    notes: string | null
  }[] = steps.map((step, index) => {
    if (step.approverType === "KEPALA_DEPARTEMEN") {
      if (isDeptHead) {
        return {
          order: index + 1,
          approverType: step.approverType,
          approverId: null,
          status: "SKIPPED" as const,
          notes: "Dilewati — pemohon adalah pejabat step ini.",
        }
      }
      const candidate = employee.department.headEmployeeId
      if (!candidate) {
        return {
          order: index + 1,
          approverType: step.approverType,
          approverId: null,
          status: "SKIPPED" as const,
          notes: "Dilewati — tidak ada approver yang bisa ditentukan untuk tipe step ini.",
        }
      }
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: candidate,
        status: "WAITING" as const,
        notes: null,
      }
    }

    if (step.approverType === "DIREKSI") {
      if (!isDeptHead) {
        return {
          order: index + 1,
          approverType: step.approverType,
          approverId: null,
          status: "SKIPPED" as const,
          notes: "Dilewati — Direksi hanya diperlukan kalau pemohon adalah Kepala Departemen.",
        }
      }
      const candidate = step.approverEmployeeId
      if (!candidate) {
        return {
          order: index + 1,
          approverType: step.approverType,
          approverId: null,
          status: "SKIPPED" as const,
          notes: "Dilewati — tidak ada approver yang bisa ditentukan untuk tipe step ini.",
        }
      }
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: candidate,
        status: "WAITING" as const,
        notes: null,
      }
    }

    return {
      order: index + 1,
      approverType: step.approverType,
      approverId: null,
      status: "SKIPPED" as const,
      notes: "Dilewati — tipe step belum didukung untuk Izin Meninggalkan Kantor.",
    }
  })

  const invalidApproverIds = await findInvalidApproverIds(resolvedSteps.map((s) => s.approverId))
  if (invalidApproverIds.length > 0) {
    return {
      error:
        "Approver yang tercatat di alur approval sudah tidak valid (datanya sudah dihapus/diubah). Hubungi HR/Admin untuk memperbarui alur approval Izin Meninggalkan Kantor.",
    }
  }

  const firstActiveIndex = resolvedSteps.findIndex((s) => s.status === "WAITING")
  if (firstActiveIndex === -1) {
    return {
      error:
        "Tidak ada approver yang bisa ditentukan untuk pengajuan ini. Hubungi HR/Admin untuk mengatur alur approval Izin Meninggalkan Kantor.",
    }
  }
  resolvedSteps[firstActiveIndex] = { ...resolvedSteps[firstActiveIndex], status: "IN_PROGRESS" }
  const approverId = resolvedSteps[firstActiveIndex].approverId as number

  const request = await prisma.$transaction(async (tx) => {
    const sequence = (await tx.officeExitRequest.count()) + 1
    const created = await tx.officeExitRequest.create({
      data: {
        publicId: buildRequestPublicId("MK", sequence),
        employeeId: employee.id,
        plannedExitTime: parsed.data.plannedExitTime,
        category: parsed.data.category,
        reason: parsed.data.reason,
        approverId,
      },
    })
    await tx.officeExitApprovalStep.createMany({
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
      title: "Pengajuan Izin Meninggalkan Kantor Baru",
      message: `${employee.fullName} mengajukan izin meninggalkan kantor pukul ${parsed.data.plannedExitTime}.`,
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "OfficeExitRequest",
    description: `${session.user.username} mengajukan izin meninggalkan kantor (${request.id}) pukul ${parsed.data.plannedExitTime}.`,
  })

  revalidateOfficeExitPaths()
  redirect(`/pegawai/riwayat-izin/meninggalkan-kantor/${request.publicId}`)
}

export async function approveOfficeExitRequestAction(
  requestId: number,
  _prevState: OfficeExitFormState,
  formData: FormData
): Promise<OfficeExitFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const catatan = String(formData.get("catatan") ?? "").trim()

  const request = await prisma.officeExitRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.officeExitApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.officeExitApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "APPROVED", actedAt: new Date(), notes: catatan || null },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  const nextStep = await prisma.officeExitApprovalStep.findFirst({
    where: { requestId, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStep && nextStep.approverId) {
    await prisma.$transaction([
      prisma.officeExitApprovalStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.officeExitRequest.update({
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
        title: "Pengajuan Izin Meninggalkan Kantor Baru",
        message: `${request.employee.fullName} mengajukan izin meninggalkan kantor pukul ${request.plannedExitTime}.`,
        link: "/admin/approval-center",
      })
    }
  } else {
    const { count: finalUpdated } = await prisma.officeExitRequest.updateMany({
      where: { id: requestId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedAt: new Date() },
    })
    if (finalUpdated === 0) {
      return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
    }

    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Izin Meninggalkan Kantor Disetujui",
        message: `Pengajuan izin meninggalkan kantor Anda pukul ${request.plannedExitTime} telah disetujui. Anda diperbolehkan meninggalkan kantor.`,
        link: `/pegawai/riwayat-izin/meninggalkan-kantor/${request.publicId}`,
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "OfficeExitRequest",
    description: `${session.user.username} menyetujui izin meninggalkan kantor (${requestId}) milik "${request.employee.fullName}".`,
  })

  revalidateOfficeExitPaths()
  return undefined
}

export async function rejectOfficeExitRequestAction(
  requestId: number,
  _prevState: OfficeExitFormState,
  formData: FormData
): Promise<OfficeExitFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = officeExitRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }

  const request = await prisma.officeExitRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.officeExitApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.officeExitApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REJECTED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  await prisma.officeExitApprovalStep.updateMany({
    where: { requestId, status: "WAITING" },
    data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak di step sebelumnya." },
  })

  const { count: finalUpdated } = await prisma.officeExitRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason },
  })
  if (finalUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Izin Meninggalkan Kantor Ditolak",
      message: `Pengajuan izin meninggalkan kantor Anda pukul ${request.plannedExitTime} ditolak. Alasan: ${parsed.data.rejectionReason}`,
      link: `/pegawai/riwayat-izin/meninggalkan-kantor/${request.publicId}`,
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "OfficeExitRequest",
    description: `${session.user.username} menolak izin meninggalkan kantor (${requestId}) milik "${request.employee.fullName}". Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateOfficeExitPaths()
  return undefined
}

export async function deleteOfficeExitRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    throw new Error("Akun Anda tidak terhubung ke data pegawai.")
  }

  const request = await prisma.officeExitRequest.findUnique({
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

  await prisma.officeExitRequest.delete({ where: { id: requestId } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "OfficeExitRequest",
    description: `${session.user.username} menghapus pengajuan izin meninggalkan kantor (${requestId}).`,
  })

  revalidateOfficeExitPaths()
}
