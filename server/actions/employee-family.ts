"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { spouseFormSchema, childFormSchema } from "@/lib/validations/employee"

export type FamilyFormState = { error?: string } | undefined

function parseDate(value?: string) {
  return value ? new Date(value) : null
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

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return undefined
}

export async function deleteSpouseAction(employeeId: number) {
  await prisma.employeeSpouse.deleteMany({ where: { employeeId } })
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

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return undefined
}

export async function deleteChildAction(childId: number, employeeId: number) {
  await prisma.employeeChild.delete({ where: { id: childId } })
  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
}
