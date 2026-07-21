"use server"

import { Prisma, RoleName } from "@prisma/client"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { computeContractEndDate, generateSecurePassword } from "@/lib/employee-utils"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { employeeFormSchema, type EmployeeFormValues } from "@/lib/validations/employee"

export type EmployeeFormState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  success?: {
    employeePublicId: string
    fullName: string
    username: string
    password: string
  }
} | undefined

function parseEmployeeForm(formData: FormData) {
  return employeeFormSchema.safeParse(Object.fromEntries(formData))
}

function parseOptionalId(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

function buildPersonalFields(data: EmployeeFormValues) {
  return {
    pinAttendance: data.pinAttendance || null,
    lastEducation: data.lastEducation || null,
    major: data.major || null,
    degree: data.degree || null,
    rank: data.rank || null,
    maritalStatus: data.maritalStatus || null,
    exitLetterNumber: data.exitLetterNumber || null,
    hobby: data.hobby || null,
    emergencyPhone: data.emergencyPhone || null,
    instagram: data.instagram || null,
    tiktok: data.tiktok || null,
    facebook: data.facebook || null,
    ktpAddress: data.ktpAddress || null,
    domicileKtp: data.domicileKtp || null,
    motherName: data.motherName || null,
    fatherName: data.fatherName || null,
    illness: data.illness || null,
    sideBusiness: data.sideBusiness || null,
  }
}

export async function createEmployeeAction(
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const parsed = parseEmployeeForm(formData)
  if (!parsed.success) {
    return {
      error: "Periksa kembali data yang diisi.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }
  const data = parsed.data

  const employmentStatus = await prisma.employmentStatus.findUnique({
    where: { id: data.employmentStatusId },
  })
  if (!employmentStatus) {
    return { error: "Status kepegawaian tidak valid." }
  }

  const employeeRole = await prisma.role.findUnique({
    where: { name: RoleName.EMPLOYEE },
  })
  if (!employeeRole) {
    return { error: "Role EMPLOYEE belum tersedia. Jalankan seed terlebih dahulu." }
  }

  const startDate = new Date(data.startDate)
  const birthDate = new Date(data.birthDate)
  const contractEndDate = computeContractEndDate(startDate, employmentStatus.name)
  const session = await auth()
  const temporaryPassword = generateSecurePassword()
  let employeePublicId = ""

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeNumber: data.employeeNumber,
          fullName: data.fullName,
          startDate,
          contractEndDate,
          departmentId: data.departmentId,
          positionId: data.positionId,
          workLocationId: data.workLocationId,
          employmentStatusId: data.employmentStatusId,
          reportsToId: parseOptionalId(data.reportsToId),
          workShiftId: parseOptionalId(data.workShiftId),
          birthDate,
          birthPlace: data.birthPlace,
          gender: data.gender,
          nik: data.nik,
          address: data.address,
          phone: data.phone,
          email: data.email,
          ...buildPersonalFields(data),
        },
      })
      employeePublicId = employee.publicId

      const passwordHash = await bcrypt.hash(temporaryPassword, 10)
      await tx.user.create({
        data: {
          username: data.employeeNumber,
          password: passwordHash,
          roleId: employeeRole.id,
          employeeId: employee.id,
          isActive: true,
        },
      })
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[] | undefined) ?? []
      if (target.includes("pinAttendance")) {
        return { error: "PIN mesin absensi ini sudah dipakai pegawai lain." }
      }
      return { error: "NIP sudah terpakai oleh pegawai/akun lain." }
    }
    throw err
  }

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "CREATE",
    entityType: "Employee",
    description: `${session?.user.username ?? "system"} menambahkan pegawai baru "${data.fullName}" (${data.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  return {
    success: {
      employeePublicId,
      fullName: data.fullName,
      username: data.employeeNumber,
      password: temporaryPassword,
    },
  }
}

export async function updateEmployeeAction(
  employeeId: number,
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const parsed = parseEmployeeForm(formData)
  if (!parsed.success) {
    return {
      error: "Periksa kembali data yang diisi.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }
  const data = parsed.data

  const employmentStatus = await prisma.employmentStatus.findUnique({
    where: { id: data.employmentStatusId },
  })
  if (!employmentStatus) {
    return { error: "Status kepegawaian tidak valid." }
  }

  const reportsToId = parseOptionalId(data.reportsToId)
  if (reportsToId === employeeId) {
    return { error: "Pegawai tidak bisa melapor kepada dirinya sendiri." }
  }
  const workShiftId = parseOptionalId(data.workShiftId)

  const startDate = new Date(data.startDate)
  const birthDate = new Date(data.birthDate)
  const contractEndDate = computeContractEndDate(startDate, employmentStatus.name)
  const session = await auth()

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        employeeNumber: data.employeeNumber,
        fullName: data.fullName,
        startDate,
        contractEndDate,
        departmentId: data.departmentId,
        positionId: data.positionId,
        workLocationId: data.workLocationId,
        employmentStatusId: data.employmentStatusId,
        reportsToId,
        workShiftId,
        birthDate,
        birthPlace: data.birthPlace,
        gender: data.gender,
        nik: data.nik,
        address: data.address,
        phone: data.phone,
        email: data.email,
        ...buildPersonalFields(data),
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[] | undefined) ?? []
      if (target.includes("pinAttendance")) {
        return { error: "PIN mesin absensi ini sudah dipakai pegawai lain." }
      }
      return { error: "NIP sudah terpakai oleh pegawai lain." }
    }
    throw err
  }

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "UPDATE",
    entityType: "Employee",
    description: `${session?.user.username ?? "system"} memperbarui data pegawai "${data.fullName}" (${data.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  redirect("/admin/pegawai?toast=employee-updated")
}

export async function softDeleteEmployeeAction(
  employeeId: number,
  reason: string
) {
  const session = await auth()
  const deletedBy = session?.user.username ?? "system"

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: {
        isDeleted: true,
        isActive: false,
        deleteReason: reason || null,
        deletedAt: new Date(),
        deletedBy,
      },
    })
    await tx.user.updateMany({
      where: { employeeId },
      data: { isActive: false },
    })
    return updated
  })

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: deletedBy,
    action: "DELETE",
    entityType: "Employee",
    description: `${deletedBy} menghapus (soft-delete) pegawai "${employee.fullName}" (${employee.employeeNumber}).${reason ? ` Alasan: ${reason}` : ""}`,
  })

  revalidatePath("/admin/pegawai")
}

export async function restoreEmployeeAction(employeeId: number) {
  const session = await auth()

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: {
        isDeleted: false,
        isActive: true,
        deleteReason: null,
        deletedAt: null,
        deletedBy: null,
      },
    })
    await tx.user.updateMany({
      where: { employeeId },
      data: { isActive: true },
    })
    return updated
  })

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "RESTORE",
    entityType: "Employee",
    description: `${session?.user.username ?? "system"} memulihkan pegawai "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
}

// Admin buka/tutup "jendela" update mandiri per pegawai — dipakai buat pola
// update data tahunan (lihat catatan di Employee.allowSelfUpdate). Otomatis
// terkunci lagi begitu pegawai berhasil menyimpan lewat updateOwnProfileAction.
export async function toggleEmployeeSelfUpdateAction(employeeId: number, enabled: boolean) {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    throw new Error("Anda tidak berwenang mengubah izin ini.")
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data: { allowSelfUpdate: enabled },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} ${enabled ? "mengaktifkan" : "menonaktifkan"} izin update mandiri untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
}

// Admin buka pengecualian Cuti Khusus Haji/Umroh per pegawai (Pasal 41
// membatasi 1x seumur bekerja per jenis) — otomatis dipadamkan lagi begitu
// terpakai untuk satu pengajuan baru, lihat server/actions/special-leave.ts.
export async function toggleSpecialLeaveExceptionAction(
  employeeId: number,
  type: "HAJI" | "UMROH",
  enabled: boolean
) {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    throw new Error("Anda tidak berwenang mengubah izin ini.")
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data:
      type === "HAJI"
        ? { allowSpecialLeaveExceptionHaji: enabled }
        : { allowSpecialLeaveExceptionUmroh: enabled },
  })

  const typeLabel = type === "HAJI" ? "Haji" : "Umroh"
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} ${enabled ? "membuka" : "menutup"} pengecualian Cuti Khusus ${typeLabel} untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  revalidatePath(`/admin/pegawai/${employee.publicId}/detail`)
}

// Admin buka pengecualian Cuti Besar per pegawai (Pasal 38 membatasi 2x
// seumur bekerja) — otomatis dipadamkan lagi begitu terpakai untuk satu
// pengajuan baru, lihat server/actions/cuti-besar.ts.
export async function toggleCutiBesarExceptionAction(employeeId: number, enabled: boolean) {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    throw new Error("Anda tidak berwenang mengubah izin ini.")
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data: { allowCutiBesarException: enabled },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} ${enabled ? "membuka" : "menutup"} pengecualian Cuti Besar untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  revalidatePath(`/admin/pegawai/${employee.publicId}/detail`)
}
