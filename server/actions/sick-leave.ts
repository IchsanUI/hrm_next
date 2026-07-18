"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { saveUploadedFile } from "@/lib/file-upload"
import { buildRequestPublicId } from "@/lib/request-public-id"
import {
  sickLeaveRequestSchema,
  sickLeaveRejectionSchema,
  sickLeaveRevisionSchema,
  sickLeaveResubmitSchema,
} from "@/lib/validations/sick-leave"

export type SickLeaveFormState = { error?: string } | undefined

function revalidateSickLeavePaths() {
  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/riwayat-izin`)
    revalidatePath(`${prefix}/approval-center`)
  }
}

export async function createSickLeaveRequestAction(
  _prevState: SickLeaveFormState,
  formData: FormData
): Promise<SickLeaveFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = sickLeaveRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: {
      id: true,
      fullName: true,
      departmentId: true,
      department: { select: { headEmployeeId: true } },
    },
  })
  if (!employee) {
    return { error: "Data pegawai tidak ditemukan." }
  }

  // Pegawai Pengganti opsional — kalau diisi, validasi ulang di server (satu
  // departemen, bukan diri sendiri) walau dropdown di form sudah difilter.
  let substituteEmployeeId: number | null = null
  let substituteEmployeeName: string | null = null
  if (parsed.data.substituteEmployeeId !== "" && parsed.data.substituteEmployeeId !== undefined) {
    const substitute = await prisma.employee.findUnique({
      where: { id: parsed.data.substituteEmployeeId },
      select: { id: true, fullName: true, departmentId: true },
    })
    if (!substitute) {
      return { error: "Pegawai pengganti tidak ditemukan." }
    }
    if (substitute.id === employee.id) {
      return { error: "Pegawai pengganti tidak boleh diri sendiri." }
    }
    if (substitute.departmentId !== employee.departmentId) {
      return { error: "Pegawai pengganti harus dari departemen yang sama." }
    }
    substituteEmployeeId = substitute.id
    substituteEmployeeName = substitute.fullName
  }

  const flow = await prisma.approvalFlow.findUnique({
    where: { leaveType: "IZIN_SAKIT" },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  const steps =
    flow && flow.steps.length > 0
      ? flow.steps
      : [{ approverType: "KEPALA_DEPARTEMEN" as const, approverEmployeeId: null }]

  const resolvedSteps: {
    order: number
    approverType: (typeof steps)[number]["approverType"]
    approverId: number | null
    status: "WAITING" | "IN_PROGRESS" | "SKIPPED"
    notes: string | null
  }[] = steps.map((step, index) => {
    if (step.approverType === "PEGAWAI_PENGGANTI") {
      if (!substituteEmployeeId) {
        return {
          order: index + 1,
          approverType: step.approverType,
          approverId: null,
          status: "SKIPPED" as const,
          notes: "Dilewati — pemohon tidak memilih pegawai pengganti.",
        }
      }
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: substituteEmployeeId,
        status: "WAITING" as const,
        notes: null,
      }
    }

    const candidate =
      step.approverType === "KEPALA_DEPARTEMEN"
        ? employee.department.headEmployeeId
        : step.approverType === "DIREKSI" || step.approverType === "PEGAWAI_TERTENTU"
          ? step.approverEmployeeId
          : null // HR belum diaktifkan di runtime

    if (!candidate) {
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: null,
        status: "SKIPPED" as const,
        notes: "Dilewati — tidak ada approver yang bisa ditentukan untuk tipe step ini.",
      }
    }
    if (candidate === employee.id) {
      return {
        order: index + 1,
        approverType: step.approverType,
        approverId: null,
        status: "SKIPPED" as const,
        notes: "Dilewati — pemohon adalah pejabat step ini.",
      }
    }
    return {
      order: index + 1,
      approverType: step.approverType,
      approverId: candidate,
      status: "WAITING" as const,
      notes: null,
    }
  })

  const firstActiveIndex = resolvedSteps.findIndex((s) => s.status === "WAITING")
  if (firstActiveIndex === -1) {
    return {
      error:
        "Tidak ada approver yang bisa ditentukan untuk pengajuan ini. Hubungi HR/Admin untuk mengatur alur approval Izin Sakit.",
    }
  }
  resolvedSteps[firstActiveIndex] = { ...resolvedSteps[firstActiveIndex], status: "IN_PROGRESS" }
  const approverId = resolvedSteps[firstActiveIndex].approverId as number
  const firstStepType = resolvedSteps[firstActiveIndex].approverType

  const request = await prisma.$transaction(async (tx) => {
    const sequence = (await tx.sickLeaveRequest.count()) + 1
    const created = await tx.sickLeaveRequest.create({
      data: {
        publicId: buildRequestPublicId("SK", sequence),
        employeeId: employee.id,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        reason: parsed.data.reason,
        substituteEmployeeId,
        substituteEmployeeName,
        approverId,
      },
    })
    await tx.sickLeaveApprovalStep.createMany({
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
      title:
        firstStepType === "PEGAWAI_PENGGANTI"
          ? "Anda Ditunjuk sebagai Pegawai Pengganti"
          : "Pengajuan Izin Sakit Baru",
      message:
        firstStepType === "PEGAWAI_PENGGANTI"
          ? `${employee.fullName} mengajukan Anda sebagai pegawai pengganti selama izin sakit.`
          : `${employee.fullName} mengajukan izin sakit.`,
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "SickLeaveRequest",
    description: `${session.user.username} mengajukan izin sakit (${request.id}).`,
  })

  revalidateSickLeavePaths()
  redirect(`/pegawai/riwayat-izin/sakit/${request.publicId}`)
}

export async function approveSickLeaveRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.sickLeaveRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.sickLeaveApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.sickLeaveApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "APPROVED", actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  const nextStep = await prisma.sickLeaveApprovalStep.findFirst({
    where: { requestId, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStep && nextStep.approverId) {
    await prisma.$transaction([
      prisma.sickLeaveApprovalStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.sickLeaveRequest.update({
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
        title:
          nextStep.approverType === "PEGAWAI_PENGGANTI"
            ? "Anda Ditunjuk sebagai Pegawai Pengganti"
            : "Pengajuan Izin Sakit Baru",
        message:
          nextStep.approverType === "PEGAWAI_PENGGANTI"
            ? `${request.employee.fullName} mengajukan Anda sebagai pegawai pengganti selama izin sakit.`
            : `${request.employee.fullName} mengajukan izin sakit.`,
        link: "/admin/approval-center",
      })
    }
  } else {
    const { count: finalUpdated } = await prisma.sickLeaveRequest.updateMany({
      where: { id: requestId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedAt: new Date() },
    })
    if (finalUpdated === 0) {
      return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
    }

    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Izin Sakit Disetujui",
        message: "Pengajuan izin sakit Anda telah disetujui.",
        link: `/pegawai/riwayat-izin/sakit/${request.publicId}`,
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "SickLeaveRequest",
    description: `${session.user.username} menyetujui izin sakit (${requestId}).`,
  })

  revalidateSickLeavePaths()
  return undefined
}

export async function rejectSickLeaveRequestAction(
  requestId: number,
  _prevState: SickLeaveFormState,
  formData: FormData
): Promise<SickLeaveFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = sickLeaveRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }

  const request = await prisma.sickLeaveRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.sickLeaveApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }
  // Pegawai Pengganti tidak berhak menolak pengajuan sakitnya — mereka cuma
  // bisa menyatakan tidak bersedia jadi pengganti lewat reviseSickLeaveRequestAction.
  if (currentStep.approverType === "PEGAWAI_PENGGANTI") {
    return { error: "Gunakan tombol \"Tidak Bersedia\" untuk step ini." }
  }

  const { count: stepUpdated } = await prisma.sickLeaveApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REJECTED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  await prisma.sickLeaveApprovalStep.updateMany({
    where: { requestId, status: "WAITING" },
    data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak di step sebelumnya." },
  })

  const { count: finalUpdated } = await prisma.sickLeaveRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason },
  })
  if (finalUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Izin Sakit Ditolak",
      message: `Pengajuan izin sakit Anda ditolak. Alasan: ${parsed.data.rejectionReason}`,
      link: `/pegawai/riwayat-izin/sakit/${request.publicId}`,
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "SickLeaveRequest",
    description: `${session.user.username} menolak izin sakit (${requestId}). Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateSickLeavePaths()
  return undefined
}

// Pegawai pengganti menyatakan TIDAK BERSEDIA — ini BUKAN penolakan izin
// sakitnya. Status pengajuan jadi "REVISI" (bukan "REJECTED"), pemohon
// tinggal pilih pengganti baru lewat resubmitSickLeaveRequestAction.
export async function reviseSickLeaveRequestAction(
  requestId: number,
  _prevState: SickLeaveFormState,
  formData: FormData
): Promise<SickLeaveFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = sickLeaveRevisionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan tidak bersedia wajib diisi." }
  }

  const request = await prisma.sickLeaveRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.sickLeaveApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan pegawai pengganti untuk pengajuan ini." }
  }
  if (currentStep.approverType !== "PEGAWAI_PENGGANTI") {
    return { error: "Step ini tidak bisa direvisi." }
  }

  const { count: stepUpdated } = await prisma.sickLeaveApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REVISED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  const { count: revisedCount } = await prisma.sickLeaveRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REVISI" },
  })
  if (revisedCount === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Pegawai Pengganti Tidak Bersedia",
      message: `${request.substituteEmployeeName ?? "Pegawai pengganti"} menyatakan tidak bersedia. Alasan: ${parsed.data.rejectionReason}. Silakan pilih pengganti baru.`,
      link: `/pegawai/riwayat-izin/sakit/${request.publicId}`,
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "SickLeaveRequest",
    description: `${session.user.username} menyatakan tidak bersedia jadi pengganti untuk izin sakit (${requestId}). Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateSickLeavePaths()
  return undefined
}

// Pemohon memilih pengganti baru setelah pengganti sebelumnya menyatakan
// tidak bersedia — membuat baris step BARU di order yang sama (baris lama
// tetap tersimpan sebagai riwayat), TIDAK mengulang dari step Kepala Departemen.
export async function resubmitSickLeaveRequestAction(
  requestId: number,
  _prevState: SickLeaveFormState,
  formData: FormData
): Promise<SickLeaveFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = sickLeaveResubmitSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pilih pegawai pengganti baru." }
  }

  const request = await prisma.sickLeaveRequest.findUnique({ where: { id: requestId } })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.employeeId !== session.user.employeeId) {
    return { error: "Anda tidak berhak mengajukan ulang pengajuan ini." }
  }
  if (request.status !== "REVISI") {
    return { error: "Pengajuan ini tidak sedang menunggu revisi." }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: request.employeeId },
    select: { departmentId: true },
  })
  const substitute = await prisma.employee.findUnique({
    where: { id: parsed.data.newSubstituteEmployeeId },
    select: { id: true, fullName: true, departmentId: true, user: { select: { id: true } } },
  })
  if (!substitute) {
    return { error: "Pegawai pengganti tidak ditemukan." }
  }
  if (substitute.id === request.employeeId) {
    return { error: "Pegawai pengganti tidak boleh diri sendiri." }
  }
  if (!employee || substitute.departmentId !== employee.departmentId) {
    return { error: "Pegawai pengganti harus dari departemen yang sama." }
  }

  const revisedStep = await prisma.sickLeaveApprovalStep.findFirst({
    where: { requestId, status: "REVISED" },
    orderBy: { actedAt: "desc" },
  })
  if (!revisedStep) {
    return { error: "Tidak ditemukan step yang perlu direvisi." }
  }

  await prisma.$transaction([
    prisma.sickLeaveApprovalStep.create({
      data: {
        requestId,
        order: revisedStep.order,
        approverType: "PEGAWAI_PENGGANTI",
        approverId: substitute.id,
        status: "IN_PROGRESS",
      },
    }),
    prisma.sickLeaveRequest.update({
      where: { id: requestId },
      data: {
        status: "PENDING_APPROVAL",
        substituteEmployeeId: substitute.id,
        substituteEmployeeName: substitute.fullName,
        approverId: substitute.id,
      },
    }),
  ])

  if (substitute.user?.id) {
    await createNotification({
      userId: substitute.user.id,
      title: "Anda Ditunjuk sebagai Pegawai Pengganti",
      message: "Anda diajukan sebagai pegawai pengganti selama izin sakit rekan Anda.",
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "SickLeaveRequest",
    description: `${session.user.username} mengajukan ulang izin sakit (${requestId}) dengan pengganti baru "${substitute.fullName}".`,
  })

  revalidateSickLeavePaths()
  return undefined
}

// Surat Keterangan Sakit/Dokter — SENGAJA tidak digerbang status approval,
// boleh menyusul kapan saja setelah pengajuan dibuat.
export async function uploadSickLeaveCertificateAction(
  requestId: number,
  _prevState: SickLeaveFormState,
  formData: FormData
): Promise<SickLeaveFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.sickLeaveRequest.findUnique({ where: { id: requestId } })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.employeeId !== session.user.employeeId) {
    return { error: "Anda tidak berhak melengkapi pengajuan ini." }
  }

  const file = formData.get("certificate")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Surat keterangan sakit wajib diunggah." }
  }

  const certificateUrl = await saveUploadedFile(file, "sakit-surat-dokter", session.user.employeeId)
  if (!certificateUrl) {
    return { error: "Surat keterangan sakit wajib diunggah." }
  }

  await prisma.sickLeaveRequest.update({
    where: { id: requestId },
    data: { medicalCertificateUrl: certificateUrl, medicalCertificateUploadedAt: new Date() },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "SickLeaveRequest",
    description: `${session.user.username} mengunggah surat keterangan sakit untuk izin sakit (${requestId}).`,
  })

  revalidateSickLeavePaths()
  return undefined
}

export async function deleteSickLeaveRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    throw new Error("Akun Anda tidak terhubung ke data pegawai.")
  }

  const request = await prisma.sickLeaveRequest.findUnique({
    where: { id: requestId },
    include: { approvalSteps: true },
  })
  if (!request) {
    throw new Error("Pengajuan tidak ditemukan.")
  }
  if (request.employeeId !== session.user.employeeId) {
    throw new Error("Anda tidak berhak menghapus pengajuan ini.")
  }
  if (request.status !== "PENDING_APPROVAL" && request.status !== "REVISI") {
    throw new Error("Pengajuan ini sudah diproses dan tidak bisa dihapus.")
  }
  const alreadyApproved = request.approvalSteps.some((s) => s.status === "APPROVED")
  if (alreadyApproved) {
    throw new Error(
      "Pengajuan ini sudah disetujui salah satu approver dan tidak bisa dihapus."
    )
  }

  await prisma.sickLeaveRequest.delete({ where: { id: requestId } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "SickLeaveRequest",
    description: `${session.user.username} menghapus pengajuan izin sakit (${requestId}).`,
  })

  revalidateSickLeavePaths()
}
