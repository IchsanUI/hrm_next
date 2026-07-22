"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { saveUploadedFile } from "@/lib/file-upload"
import { buildRequestPublicId } from "@/lib/request-public-id"
import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { resolveNearestLocationLabel } from "@/lib/geo"
import {
  offSiteAttendanceRequestSchema,
  offSiteAttendanceRejectionSchema,
} from "@/lib/validations/off-site-attendance"

export type OffSiteAttendanceFormState = { error?: string } | undefined

function revalidateOffSiteAttendancePaths() {
  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/riwayat-izin`)
    revalidatePath(`${prefix}/approval-center`)
  }
}

export async function createOffSiteAttendanceRequestAction(
  _prevState: OffSiteAttendanceFormState,
  formData: FormData
): Promise<OffSiteAttendanceFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const blockReason = await getIzinTypeBlockReason("IZIN_ABSEN_LUAR_KANTOR")
  if (blockReason) {
    return { error: blockReason }
  }

  const parsed = offSiteAttendanceRequestSchema.safeParse(Object.fromEntries(formData))
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

  const file = formData.get("evidence")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bukti pendukung wajib dilampirkan." }
  }
  const evidenceUrl = await saveUploadedFile(file, "absen-luar-kantor-bukti", employee.id)
  if (!evidenceUrl) {
    return { error: "Bukti pendukung wajib dilampirkan." }
  }

  // Lokasi GPS cuma data tambahan buat cross-check terhadap isian manual di
  // atas — kalau browser menolak izin lokasi, pengajuan tetap jalan seperti
  // biasa, tidak pernah diblokir (sama pola dengan Izin Lembur/Terlambat).
  let locationLabel: string | null = null
  const locationLat = parsed.data.locationLat === "" ? null : (parsed.data.locationLat ?? null)
  const locationLng = parsed.data.locationLng === "" ? null : (parsed.data.locationLng ?? null)
  if (locationLat !== null && locationLng !== null) {
    const workLocations = await prisma.workLocation.findMany({
      select: { name: true, latitude: true, longitude: true, geofenceRadius: true },
    })
    const nearest = resolveNearestLocationLabel(locationLat, locationLng, workLocations)
    locationLabel = nearest?.label ?? null
  }

  const flow = await prisma.approvalFlow.findUnique({
    where: { leaveType: "IZIN_ABSEN_LUAR_KANTOR" },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  const steps =
    flow && flow.steps.length > 0
      ? flow.steps
      : [{ approverType: "ATASAN_LANGSUNG" as const, approverEmployeeId: null }]

  // Resolusi generik — persis pola Izin Terlambat/Lembur: ATASAN_LANGSUNG/
  // KEPALA_DEPARTEMEN auto-skip kalau pemohon sendiri pejabatnya, DIREKSI/
  // PEGAWAI_TERTENTU selalu jalan ke approver tetap.
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
        "Tidak ada approver yang bisa ditentukan untuk pengajuan ini. Hubungi HR/Admin untuk mengatur alur approval Izin Absen Diluar Kantor.",
    }
  }
  resolvedSteps[firstActiveIndex] = { ...resolvedSteps[firstActiveIndex], status: "IN_PROGRESS" }
  const approverId = resolvedSteps[firstActiveIndex].approverId as number

  const request = await prisma.$transaction(async (tx) => {
    const sequence = (await tx.offSiteAttendanceRequest.count()) + 1
    const created = await tx.offSiteAttendanceRequest.create({
      data: {
        publicId: buildRequestPublicId("AL", sequence),
        employeeId: employee.id,
        date: new Date(parsed.data.date),
        location: parsed.data.location,
        reason: parsed.data.reason,
        evidenceUrl,
        locationLat,
        locationLng,
        locationLabel,
        approverId,
      },
    })
    await tx.offSiteAttendanceApprovalStep.createMany({
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
      title: "Pengajuan Izin Absen Diluar Kantor Baru",
      message: `${employee.fullName} mengajukan izin absen diluar kantor.`,
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "OffSiteAttendanceRequest",
    description: `${session.user.username} mengajukan izin absen diluar kantor (${request.id}).`,
  })

  revalidateOffSiteAttendancePaths()
  redirect(`/pegawai/riwayat-izin/absen-luar-kantor/${request.publicId}`)
}

export async function approveOffSiteAttendanceRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.offSiteAttendanceRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.offSiteAttendanceApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.offSiteAttendanceApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "APPROVED", actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  const nextStep = await prisma.offSiteAttendanceApprovalStep.findFirst({
    where: { requestId, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStep && nextStep.approverId) {
    await prisma.$transaction([
      prisma.offSiteAttendanceApprovalStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.offSiteAttendanceRequest.update({
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
        title: "Pengajuan Izin Absen Diluar Kantor Baru",
        message: `${request.employee.fullName} mengajukan izin absen diluar kantor.`,
        link: "/admin/approval-center",
      })
    }
  } else {
    const { count: finalUpdated } = await prisma.offSiteAttendanceRequest.updateMany({
      where: { id: requestId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedAt: new Date() },
    })
    if (finalUpdated === 0) {
      return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
    }

    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Izin Absen Diluar Kantor Disetujui",
        message: "Pengajuan izin absen diluar kantor Anda telah disetujui.",
        link: `/pegawai/riwayat-izin/absen-luar-kantor/${request.publicId}`,
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "OffSiteAttendanceRequest",
    description: `${session.user.username} menyetujui izin absen diluar kantor (${requestId}) milik "${request.employee.fullName}".`,
  })

  revalidateOffSiteAttendancePaths()
  return undefined
}

export async function rejectOffSiteAttendanceRequestAction(
  requestId: number,
  _prevState: OffSiteAttendanceFormState,
  formData: FormData
): Promise<OffSiteAttendanceFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = offSiteAttendanceRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }

  const request = await prisma.offSiteAttendanceRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.offSiteAttendanceApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.offSiteAttendanceApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REJECTED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  await prisma.offSiteAttendanceApprovalStep.updateMany({
    where: { requestId, status: "WAITING" },
    data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak di step sebelumnya." },
  })

  const { count: finalUpdated } = await prisma.offSiteAttendanceRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason },
  })
  if (finalUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Izin Absen Diluar Kantor Ditolak",
      message: `Pengajuan izin absen diluar kantor Anda ditolak. Alasan: ${parsed.data.rejectionReason}`,
      link: `/pegawai/riwayat-izin/absen-luar-kantor/${request.publicId}`,
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "OffSiteAttendanceRequest",
    description: `${session.user.username} menolak izin absen diluar kantor (${requestId}) milik "${request.employee.fullName}". Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateOffSiteAttendancePaths()
  return undefined
}

export async function deleteOffSiteAttendanceRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    throw new Error("Akun Anda tidak terhubung ke data pegawai.")
  }

  const request = await prisma.offSiteAttendanceRequest.findUnique({
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

  await prisma.offSiteAttendanceRequest.delete({ where: { id: requestId } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "OffSiteAttendanceRequest",
    description: `${session.user.username} menghapus pengajuan izin absen diluar kantor (${requestId}).`,
  })

  revalidateOffSiteAttendancePaths()
}
