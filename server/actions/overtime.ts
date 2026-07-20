"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { resolveNearestLocationLabel } from "@/lib/geo"
import { saveUploadedFile } from "@/lib/file-upload"
import { buildRequestPublicId } from "@/lib/request-public-id"
import {
  overtimeRequestSchema,
  overtimeCompletionSchema,
  overtimeRejectionSchema,
  MAX_OVERTIME_PROOF_FILES,
} from "@/lib/validations/overtime"

export type OvertimeFormState = { error?: string } | undefined

function revalidateOvertimePaths() {
  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/riwayat-izin`)
    revalidatePath(`${prefix}/approval-center`)
  }
}

export async function createOvertimeRequestAction(
  _prevState: OvertimeFormState,
  formData: FormData
): Promise<OvertimeFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = overtimeRequestSchema.safeParse(Object.fromEntries(formData))
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
    where: { leaveType: "IZIN_LEMBUR" },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  const steps =
    flow && flow.steps.length > 0
      ? flow.steps
      : [{ approverType: "ATASAN_LANGSUNG" as const, approverEmployeeId: null }]

  // Resolusi SELURUH step di alur (bukan cuma step pertama yang valid) —
  // step yang pejabatnya adalah pemohon sendiri (mis. pemohon adalah kepala
  // departemennya sendiri) atau yang tipenya belum didukung di runtime
  // (HR/PEGAWAI_PENGGANTI) otomatis SKIPPED, sisanya menunggu giliran (WAITING).
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
        "Tidak ada approver yang bisa ditentukan untuk pengajuan ini. Hubungi HR/Admin untuk mengatur alur approval Izin Lembur.",
    }
  }
  resolvedSteps[firstActiveIndex] = { ...resolvedSteps[firstActiveIndex], status: "IN_PROGRESS" }
  const approverId = resolvedSteps[firstActiveIndex].approverId as number

  // Lokasi cuma data tambahan buat approver — dicocokkan ke kantor terdekat,
  // tidak pernah menggagalkan pengajuan kalau browser menolak izin lokasi.
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

  const request = await prisma.$transaction(async (tx) => {
    const sequence = (await tx.overtimeRequest.count()) + 1
    const created = await tx.overtimeRequest.create({
      data: {
        publicId: buildRequestPublicId("LB", sequence),
        employeeId: employee.id,
        date: new Date(parsed.data.date),
        task: parsed.data.task,
        locationLat,
        locationLng,
        locationLabel,
        approverId,
      },
    })
    await tx.overtimeApprovalStep.createMany({
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
      title: "Pengajuan Izin Lembur Baru",
      message: `${employee.fullName} mengajukan izin lembur untuk tanggal ${parsed.data.date}.`,
      link: "/admin/approval-center",
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "OvertimeRequest",
    description: `${session.user.username} mengajukan izin lembur (${request.id}) untuk tanggal ${parsed.data.date}.`,
  })

  revalidateOvertimePaths()
  redirect(`/pegawai/riwayat-izin/${request.publicId}`)
}

export async function approveOvertimeRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const request = await prisma.overtimeRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.overtimeApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.overtimeApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "APPROVED", actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  const nextStep = await prisma.overtimeApprovalStep.findFirst({
    where: { requestId, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStep && nextStep.approverId) {
    await prisma.$transaction([
      prisma.overtimeApprovalStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.overtimeRequest.update({
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
        title: "Pengajuan Izin Lembur Baru",
        message: `${request.employee.fullName} mengajukan izin lembur untuk tanggal ${request.date.toLocaleDateString("id-ID")}.`,
        link: "/admin/approval-center",
      })
    }
  } else {
    const { count: finalUpdated } = await prisma.overtimeRequest.updateMany({
      where: { id: requestId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedAt: new Date() },
    })
    if (finalUpdated === 0) {
      return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
    }

    if (request.employee.user?.id) {
      await createNotification({
        userId: request.employee.user.id,
        title: "Izin Lembur Disetujui",
        message: `Pengajuan izin lembur Anda untuk tanggal ${request.date.toLocaleDateString("id-ID")} telah disetujui. Silakan lengkapi hasil lembur setelah selesai.`,
        link: `/pegawai/riwayat-izin/${request.publicId}`,
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "OvertimeRequest",
    description: `${session.user.username} menyetujui izin lembur (${requestId}) milik "${request.employee.fullName}".`,
  })

  revalidateOvertimePaths()
  return undefined
}

export async function rejectOvertimeRequestAction(
  requestId: number,
  _prevState: OvertimeFormState,
  formData: FormData
): Promise<OvertimeFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = overtimeRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }

  const request = await prisma.overtimeRequest.findUnique({
    where: { id: requestId },
    include: { employee: { select: { fullName: true, user: { select: { id: true } } } } },
  })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: "Pengajuan ini sudah diproses sebelumnya." }
  }

  const currentStep = await prisma.overtimeApprovalStep.findFirst({
    where: { requestId, status: "IN_PROGRESS" },
  })
  if (!currentStep || currentStep.approverId !== session.user.employeeId) {
    return { error: "Anda bukan approver untuk pengajuan ini." }
  }

  const { count: stepUpdated } = await prisma.overtimeApprovalStep.updateMany({
    where: { id: currentStep.id, status: "IN_PROGRESS" },
    data: { status: "REJECTED", notes: parsed.data.rejectionReason, actedAt: new Date() },
  })
  if (stepUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  await prisma.overtimeApprovalStep.updateMany({
    where: { requestId, status: "WAITING" },
    data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak di step sebelumnya." },
  })

  const { count: finalUpdated } = await prisma.overtimeRequest.updateMany({
    where: { id: requestId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", rejectionReason: parsed.data.rejectionReason },
  })
  if (finalUpdated === 0) {
    return { error: "Pengajuan sudah diproses oleh orang lain. Refresh halaman." }
  }

  if (request.employee.user?.id) {
    await createNotification({
      userId: request.employee.user.id,
      title: "Izin Lembur Ditolak",
      message: `Pengajuan izin lembur Anda untuk tanggal ${request.date.toLocaleDateString("id-ID")} ditolak. Alasan: ${parsed.data.rejectionReason}`,
      link: `/pegawai/riwayat-izin/${request.publicId}`,
    })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "OvertimeRequest",
    description: `${session.user.username} menolak izin lembur (${requestId}) milik "${request.employee.fullName}". Alasan: ${parsed.data.rejectionReason}`,
  })

  revalidateOvertimePaths()
  return undefined
}

export async function completeOvertimeRequestAction(
  requestId: number,
  _prevState: OvertimeFormState,
  formData: FormData
): Promise<OvertimeFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = overtimeCompletionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const proofFiles = formData
    .getAll("proof")
    .filter((f): f is File => f instanceof File && f.size > 0)
  if (proofFiles.length === 0) {
    return { error: "Bukti lembur wajib diunggah minimal 1 foto." }
  }
  if (proofFiles.length > MAX_OVERTIME_PROOF_FILES) {
    return { error: `Bukti lembur maksimal ${MAX_OVERTIME_PROOF_FILES} foto.` }
  }

  const request = await prisma.overtimeRequest.findUnique({ where: { id: requestId } })
  if (!request) {
    return { error: "Pengajuan tidak ditemukan." }
  }
  if (request.employeeId !== session.user.employeeId) {
    return { error: "Anda tidak berhak melengkapi pengajuan ini." }
  }
  if (request.status !== "APPROVED") {
    return { error: "Pengajuan ini belum disetujui atau sudah dilengkapi." }
  }

  // Sequential (bukan Promise.all) — saveUploadedFile pakai Date.now() buat
  // nama file, jalan berurutan supaya tiap file dijamin dapat nama unik.
  const proofUrls: string[] = []
  for (const file of proofFiles) {
    const url = await saveUploadedFile(file, "lembur-bukti", session.user.employeeId)
    if (url) proofUrls.push(url)
  }

  const [startHour, startMinute] = parsed.data.actualStartTime.split(":").map(Number)
  const [endHour, endMinute] = parsed.data.actualEndTime.split(":").map(Number)
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  // Lembur bisa melewati tengah malam (mis. 22:00 - 02:00) — kalau jam
  // selesai lebih kecil dari jam mulai, anggap sudah lewat hari berikutnya.
  const durationMinutes =
    endMinutes > startMinutes ? endMinutes - startMinutes : 24 * 60 - startMinutes + endMinutes
  const actualHours = Math.round((durationMinutes / 60) * 100) / 100

  await prisma.$transaction([
    prisma.overtimeRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        actualStartTime: parsed.data.actualStartTime,
        actualEndTime: parsed.data.actualEndTime,
        actualHours,
        resultDescription: parsed.data.resultDescription,
        completedAt: new Date(),
      },
    }),
    prisma.overtimeProof.createMany({
      data: proofUrls.map((url) => ({ requestId, url })),
    }),
  ])

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "OvertimeRequest",
    description: `${session.user.username} melengkapi hasil izin lembur (${requestId}).`,
  })

  revalidateOvertimePaths()
  return undefined
}

export async function deleteOvertimeRequestAction(requestId: number) {
  const session = await auth()
  if (!session?.user.employeeId) {
    throw new Error("Akun Anda tidak terhubung ke data pegawai.")
  }

  const request = await prisma.overtimeRequest.findUnique({
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
  // Hanya boleh dihapus kalau belum ada satupun approver yang menyetujui —
  // begitu satu step disetujui, pengajuan dianggap sudah berjalan di alur.
  const alreadyApproved = request.approvalSteps.some((s) => s.status === "APPROVED")
  if (alreadyApproved) {
    throw new Error(
      "Pengajuan ini sudah disetujui salah satu approver dan tidak bisa dihapus."
    )
  }

  await prisma.overtimeRequest.delete({ where: { id: requestId } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "OvertimeRequest",
    description: `${session.user.username} menghapus pengajuan izin lembur (${requestId}).`,
  })

  revalidateOvertimePaths()
}
