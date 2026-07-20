"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { spouseFormSchema, childFormSchema } from "@/lib/validations/employee"

export type FamilyFormState = { error?: string } | undefined

function parseDate(value?: string) {
  return value ? new Date(value) : null
}

// Best-effort — dilewati kalau session/data pegawainya tidak ketemu.
async function logFamilyActivity(employeeId: number, action: "CREATE" | "UPDATE" | "DELETE", label: string) {
  const session = await auth()
  if (!session?.user) return
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeNumber: true },
  })
  if (!employee) return

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action,
    entityType: "EmployeeFamily",
    description: `${session.user.username} memperbarui ${label} untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })
}

export async function saveSpouseAction(
  employeeId: number,
  _prevState: FamilyFormState,
  formData: FormData
): Promise<FamilyFormState> {
  const parsed = spouseFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Nama pasangan wajib diisi." }
  }
  const data = parsed.data

  await prisma.employeeSpouse.upsert({
    where: { employeeId },
    update: {
      fullName: data.fullName,
      occupation: data.occupation || null,
      birthPlace: data.birthPlace || null,
      birthDate: parseDate(data.birthDate),
    },
    create: {
      employeeId,
      fullName: data.fullName,
      occupation: data.occupation || null,
      birthPlace: data.birthPlace || null,
      birthDate: parseDate(data.birthDate),
    },
  })
  await logFamilyActivity(employeeId, "UPDATE", "data pasangan")

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return undefined
}

export async function deleteSpouseAction(employeeId: number) {
  await prisma.employeeSpouse.deleteMany({ where: { employeeId } })
  await logFamilyActivity(employeeId, "DELETE", "data pasangan")
  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
}

export async function addChildAction(
  employeeId: number,
  _prevState: FamilyFormState,
  formData: FormData
): Promise<FamilyFormState> {
  const parsed = childFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Nama anak wajib diisi." }
  }
  const data = parsed.data

  await prisma.employeeChild.create({
    data: {
      employeeId,
      fullName: data.fullName,
      birthPlace: data.birthPlace || null,
      birthDate: parseDate(data.birthDate),
    },
  })
  await logFamilyActivity(employeeId, "CREATE", "data anak")

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return undefined
}

export async function deleteChildAction(childId: number, employeeId: number) {
  await prisma.employeeChild.delete({ where: { id: childId } })
  await logFamilyActivity(employeeId, "DELETE", "data anak")
  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
}
