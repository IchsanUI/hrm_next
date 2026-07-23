"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { salaryGradeSchema } from "@/lib/validations/salary-grade"

export type SalaryGradeState = { error?: string } | undefined

const PATH = "/admin/payroll/struktur-gaji"

function parseOptionalNumber(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

async function logGrade(action: string, label: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "SalaryGrade",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } golongan gaji "${label}".`,
  })
}

export async function createSalaryGradeAction(
  _prevState: SalaryGradeState,
  formData: FormData
): Promise<SalaryGradeState> {
  const parsed = salaryGradeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  try {
    await prisma.salaryGrade.create({
      data: {
        code: data.code,
        subGrade: data.subGrade,
        minSalary: parseOptionalNumber(data.minSalary),
        maxSalary: parseOptionalNumber(data.maxSalary),
        displayOrder: data.displayOrder,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `Golongan "${data.code}-${data.subGrade}" sudah ada.` }
    }
    throw err
  }
  await logGrade("CREATE", `${data.code}-${data.subGrade}`)

  revalidatePath(PATH)
  return undefined
}

export async function updateSalaryGradeAction(
  id: number,
  _prevState: SalaryGradeState,
  formData: FormData
): Promise<SalaryGradeState> {
  const parsed = salaryGradeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  try {
    await prisma.salaryGrade.update({
      where: { id },
      data: {
        code: data.code,
        subGrade: data.subGrade,
        minSalary: parseOptionalNumber(data.minSalary),
        maxSalary: parseOptionalNumber(data.maxSalary),
        displayOrder: data.displayOrder,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `Golongan "${data.code}-${data.subGrade}" sudah ada.` }
    }
    throw err
  }
  await logGrade("UPDATE", `${data.code}-${data.subGrade}`)

  revalidatePath(PATH)
  return undefined
}

export async function toggleSalaryGradeActiveAction(id: number, isActive: boolean) {
  const grade = await prisma.salaryGrade.update({
    where: { id },
    data: { isActive },
  })
  await logGrade("UPDATE", `${grade.code}-${grade.subGrade}`)
  revalidatePath(PATH)
}

export async function deleteSalaryGradeAction(id: number): Promise<SalaryGradeState> {
  const grade = await prisma.salaryGrade.findUnique({
    where: { id },
    include: { _count: { select: { employees: true, rates: true } } },
  })
  if (!grade) return undefined

  if (grade._count.employees > 0 || grade._count.rates > 0) {
    const parts: string[] = []
    if (grade._count.employees > 0) parts.push(`${grade._count.employees} pegawai`)
    if (grade._count.rates > 0) parts.push(`${grade._count.rates} baris rate di Skala Gaji PP`)
    return {
      error: `Golongan "${grade.code}-${grade.subGrade}" masih dipakai oleh ${parts.join(" & ")}. Pindahkan/hapus data itu dulu sebelum menghapus golongan ini.`,
    }
  }

  await prisma.salaryGrade.delete({ where: { id } })
  await logGrade("DELETE", `${grade.code}-${grade.subGrade}`)
  revalidatePath(PATH)
  return undefined
}
