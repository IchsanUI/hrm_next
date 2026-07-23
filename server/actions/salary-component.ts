"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { salaryComponentSchema } from "@/lib/validations/salary-component"

export type SalaryComponentState = { error?: string } | undefined

const PATH = "/admin/payroll/komponen-gaji"

function parseOptionalId(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

function parseOptionalPercentage(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

async function logComponent(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "SalaryComponent",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } komponen gaji "${name}".`,
  })
}

export async function createSalaryComponentAction(
  _prevState: SalaryComponentState,
  formData: FormData
): Promise<SalaryComponentState> {
  const parsed = salaryComponentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.$transaction(async (tx) => {
    if (data.isBaseSalary) {
      await tx.salaryComponent.updateMany({ where: { isBaseSalary: true }, data: { isBaseSalary: false } })
    }
    await tx.salaryComponent.create({
      data: {
        name: data.name,
        category: data.category,
        calculationType: data.calculationType,
        percentageValue: parseOptionalPercentage(data.percentageValue),
        baseComponentId: parseOptionalId(data.baseComponentId),
        includedInBruto: data.includedInBruto,
        isTaxable: data.isTaxable,
        isBaseSalary: data.isBaseSalary,
        displayOrder: data.displayOrder,
      },
    })
  })
  await logComponent("CREATE", data.name)

  revalidatePath(PATH)
  return undefined
}

export async function updateSalaryComponentAction(
  id: number,
  _prevState: SalaryComponentState,
  formData: FormData
): Promise<SalaryComponentState> {
  const parsed = salaryComponentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  const baseComponentId = parseOptionalId(data.baseComponentId)
  if (baseComponentId === id) {
    return { error: "Komponen tidak boleh menjadikan dirinya sendiri sebagai komponen dasar." }
  }

  await prisma.$transaction(async (tx) => {
    if (data.isBaseSalary) {
      await tx.salaryComponent.updateMany({
        where: { isBaseSalary: true, id: { not: id } },
        data: { isBaseSalary: false },
      })
    }
    await tx.salaryComponent.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        calculationType: data.calculationType,
        percentageValue: parseOptionalPercentage(data.percentageValue),
        baseComponentId,
        includedInBruto: data.includedInBruto,
        isTaxable: data.isTaxable,
        isBaseSalary: data.isBaseSalary,
        displayOrder: data.displayOrder,
      },
    })
  })
  await logComponent("UPDATE", data.name)

  revalidatePath(PATH)
  return undefined
}

export async function toggleSalaryComponentActiveAction(id: number, isActive: boolean) {
  const component = await prisma.salaryComponent.update({
    where: { id },
    data: { isActive },
  })
  await logComponent("UPDATE", component.name)
  revalidatePath(PATH)
}

export async function deleteSalaryComponentAction(id: number): Promise<SalaryComponentState> {
  const component = await prisma.salaryComponent.findUnique({
    where: { id },
    include: { dependentComponents: { select: { name: true } } },
  })
  if (!component) {
    return { error: "Komponen tidak ditemukan." }
  }
  if (component.dependentComponents.length > 0) {
    return {
      error: `Komponen ini masih dipakai sebagai dasar perhitungan oleh: ${component.dependentComponents
        .map((c) => c.name)
        .join(", ")}. Ubah/hapus komponen itu dulu.`,
    }
  }

  await prisma.salaryComponent.delete({ where: { id } })
  await logComponent("DELETE", component.name)

  revalidatePath(PATH)
  return undefined
}
