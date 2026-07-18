"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { saveUploadedFile } from "@/lib/file-upload"
import { resolveNearestLocationLabel } from "@/lib/geo"
import { buildRequestPublicId } from "@/lib/request-public-id"
import {
  lateArrivalRequestSchema,
  lateArrivalRejectionSchema,
} from "@/lib/validations/late-arrival"

export type LateArrivalFormState = { error?: string } | undefined

function revalidateLateArrivalPaths() {
  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/riwayat-izin`)
    revalidatePath(`${prefix}/approval-center`)
  }
}

export async function createLateArrivalRequestAction(
  _prevState: LateArrivalFormState,
  formData: FormData
): Promise<LateArrivalFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = lateArrivalRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const evidenceFile = formData.get("evidence")
  if (!(evidenceFile instanceof File) || evidenceFile.size === 0) {
    return { error: "Foto bukti kondisi wajib diunggah." }
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
    where: { leaveType: "IZIN_TERLAMBAT" },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  const steps =
    flow && flow.steps.length > 0
      ? flow.steps
      : [{ approverType: "ATASAN_LANGSUNG" as const, approverEmployeeId: null }]

  // Resolusi generik — persis pola Izin Lembur: ATASAN_LANGSUNG/KEPALA_DEPARTEMEN
  // auto-skip kalau pemohon sendiri pejabatnya, DIREKSI/PEGAWAI_TERTENTU selalu
  // jalan ke approver tetap.
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
        "Tidak ada approver yang bisa ditentukan untuk pengajuan ini. Hubungi HR/Admin untuk mengatur alur approval Izin Terlambat.",
    }
  }
  resolvedSteps[firstActiveIndex] = { ...resolvedSteps[firstActiveIndex], status: "IN_PROGRESS" }
  const approverId = resolvedSteps[firstActiveIndex].approverId as number

  const evidenceUrl = await saveUploadedFile(evidenceFile, "terlambat-bukti", employee.id)
  if (!evidenceUrl) {
    return { error: "Foto bukti kondisi wajib diunggah." }
  }

  const request = await prisma.$transaction(async (tx) => {
    const sequence = (await tx.lateArrivalRequest.count()) + 1
    const created = await tx.lateArrivalRequest.create({
      data: {
        publicId: buildRequestPublicId("TL", sequence),
        employeeId: employee.id,
        reason: parsed.data.reason,
        evidenceUrl,
        approverId,
      },
    })
    await tx.lateArrivalApprovalStep.createMany({
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
      title: "Pengajuan Izin Terlambat Baru",
      message: `${employee.fullName} mengajukan izin terlambat.`,
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "LateArrivalRequest",
    description: `${session.user.username} mengajukan izin terlambat (${request.id}).`,
  })

  revalidateLateArrivalPaths()
  redirect(`/pegawai/riwayat-izin/terlambat/${request.publicId}`)
}

export async function approveLateArrivalRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.lateArrivalRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.lateArrivalApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.lateArrivalApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "APPROVED", actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  const nextStep = await prisma.lateArrivalApprovalStep.findFirst({
    where: { requestId, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStep && nextStep.approverId) {
    await prisma.$transaction([
      prisma.lateArrivalApprovalStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.lateArrivalRequest.update({
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
        title: "Pengajuan Izin Terlambat Baru",
        message: `${request.employee.fullName} mengajukan izin terlambat.`,
        link: "/admin/approval-center",
      })
    }
  } else {
    const { count: finalUpdated } = await prisma.lateArrivalRequest.updateMany({
      where: { id: requestId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedAt: new Date() },
    })
    if (finalUpdated === 0) {
      return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
    }

    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Izin Terlambat Disetujui",
        message: "Pengajuan izin terlambat Anda telah disetujui.",
        link: `/pegawai/riwayat-izin/terlambat/${request.publicId}`,
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "LateArrivalRequest",
    description: `${session.user.username} menyetujui izin terlambat (${requestId}) milik "${request.employee.fullName}".`,
  })

  revalidateLateArrivalPaths()
  return undefined
}

export async function rejectLateArrivalRequestAction(
  requestId: number,
  _prevState: LateArrivalFormState,
  formData: FormData
): Promise<LateArrivalFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = lateArrivalRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }

  const request = await prisma.lateArrivalRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.lateArrivalApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.lateArrivalApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REJECTED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  await prisma.lateArrivalApprovalStep.updateMany({
    where: { requestId, status: "WAITING" },
    data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak di step sebelumnya." },
  })

  const { count: finalUpdated } = await prisma.lateArrivalRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason },
  })
  if (finalUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Izin Terlambat Ditolak",
      message: `Pengajuan izin terlambat Anda ditolak. Alasan: ${parsed.data.rejectionReason}`,
      link: `/pegawai/riwayat-izin/terlambat/${request.publicId}`,
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "LateArrivalRequest",
    description: `${session.user.username} menolak izin terlambat (${requestId}) milik "${request.employee.fullName}". Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateLateArrivalPaths()
  return undefined
}

// SENGAJA tidak digerbang status approval — pegawai boleh konfirmasi
// kedatangan kapan saja, terlepas approval-nya sudah diproses atau belum.
export async function confirmArrivalAction(
  requestId: number,
  location?: { lat: number; lng: number }
) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.lateArrivalRequest.findUnique({ where: { id: requestId } })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.employeeId !== session.user.employeeId) {
    return { error: "Anda tidak berhak mengonfirmasi pengajuan ini." }
  }
  if (request.arrivalConfirmedAt) {
    return { error: "Kedatangan Anda sudah dikonfirmasi sebelumnya." }
  }

  // Lokasi cuma data tambahan — kalau browser menolak izin lokasi, konfirmasi
  // tetap jalan seperti biasa, tidak pernah diblokir.
  let arrivalLocationLabel: string | null = null
  if (location) {
    const workLocations = await prisma.workLocation.findMany({
      select: { name: true, latitude: true, longitude: true, geofenceRadius: true },
    })
    const nearest = resolveNearestLocationLabel(location.lat, location.lng, workLocations)
    arrivalLocationLabel = nearest?.label ?? null
  }

  await prisma.lateArrivalRequest.update({
    where: { id: requestId },
    data: {
      arrivalConfirmedAt: new Date(),
      arrivalConfirmedVia: "manual",
      arrivalLat: location?.lat ?? null,
      arrivalLng: location?.lng ?? null,
      arrivalLocationLabel,
    },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "LateArrivalRequest",
    description: `${session.user.username} mengonfirmasi kedatangan untuk izin terlambat (${requestId}).`,
  })

  revalidateLateArrivalPaths()
  return undefined
}

export async function deleteLateArrivalRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    throw new Error("Akun Anda tidak terhubung ke data pegawai.")
  }

  const request = await prisma.lateArrivalRequest.findUnique({
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
  if (request.arrivalConfirmedAt) {
    throw new Error("Kedatangan Anda sudah dikonfirmasi, pengajuan ini tidak bisa dihapus.")
  }
  const alreadyApproved = request.approvalSteps.some((s) => s.status === "APPROVED")
  if (alreadyApproved) {
    throw new Error(
      "Pengajuan ini sudah disetujui salah satu approver dan tidak bisa dihapus."
    )
  }

  await prisma.lateArrivalRequest.delete({ where: { id: requestId } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "LateArrivalRequest",
    description: `${session.user.username} menghapus pengajuan izin terlambat (${requestId}).`,
  })

  revalidateLateArrivalPaths()
}
