"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import {
  bpjsSettingsSchema,
  ptkpRatesSchema,
  taxBracketSchema,
  PTKP_STATUSES,
} from "@/lib/validations/payroll-tax"

export type PayrollTaxState = { error?: string } | undefined

const PATH = "/admin/payroll/pajak-bpjs"

function parseOptionalNumber(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

async function logPayrollTax(label: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "UPDATE",
    entityType: "PayrollTaxSettings",
    description: `${session?.user.username ?? "system"} memperbarui ${label}.`,
  })
}

export async function updateBpjsSettingsAction(
  _prevState: PayrollTaxState,
  formData: FormData
): Promise<PayrollTaxState> {
  const parsed = bpjsSettingsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.bpjsSettings.upsert({
    where: { id: 1 },
    update: {
      kesehatanEmployeePercent: data.kesehatanEmployeePercent,
      kesehatanCompanyPercent: data.kesehatanCompanyPercent,
      kesehatanSalaryCap: parseOptionalNumber(data.kesehatanSalaryCap),
      jhtEmployeePercent: data.jhtEmployeePercent,
      jhtCompanyPercent: data.jhtCompanyPercent,
      jpEmployeePercent: data.jpEmployeePercent,
      jpCompanyPercent: data.jpCompanyPercent,
      jpSalaryCap: parseOptionalNumber(data.jpSalaryCap),
      jkkCompanyPercent: data.jkkCompanyPercent,
      jkmCompanyPercent: data.jkmCompanyPercent,
    },
    create: {
      id: 1,
      kesehatanEmployeePercent: data.kesehatanEmployeePercent,
      kesehatanCompanyPercent: data.kesehatanCompanyPercent,
      kesehatanSalaryCap: parseOptionalNumber(data.kesehatanSalaryCap),
      jhtEmployeePercent: data.jhtEmployeePercent,
      jhtCompanyPercent: data.jhtCompanyPercent,
      jpEmployeePercent: data.jpEmployeePercent,
      jpCompanyPercent: data.jpCompanyPercent,
      jpSalaryCap: parseOptionalNumber(data.jpSalaryCap),
      jkkCompanyPercent: data.jkkCompanyPercent,
      jkmCompanyPercent: data.jkmCompanyPercent,
    },
  })
  await logPayrollTax("pengaturan rate BPJS")
  revalidatePath(PATH)
  return undefined
}

export async function updatePtkpRatesAction(
  _prevState: PayrollTaxState,
  formData: FormData
): Promise<PayrollTaxState> {
  const parsed = ptkpRatesSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.$transaction(
    PTKP_STATUSES.map((status) =>
      prisma.ptkpRate.upsert({
        where: { status },
        update: { annualAmount: data[status] },
        create: { status, annualAmount: data[status] },
      })
    )
  )
  await logPayrollTax("tabel PTKP")
  revalidatePath(PATH)
  return undefined
}

export async function createTaxBracketAction(
  _prevState: PayrollTaxState,
  formData: FormData
): Promise<PayrollTaxState> {
  const parsed = taxBracketSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.taxBracket.create({
    data: {
      order: data.order,
      minIncome: data.minIncome,
      maxIncome: parseOptionalNumber(data.maxIncome),
      ratePercent: data.ratePercent,
    },
  })
  await logPayrollTax("lapisan tarif PPh 21")
  revalidatePath(PATH)
  return undefined
}

export async function updateTaxBracketAction(
  id: number,
  _prevState: PayrollTaxState,
  formData: FormData
): Promise<PayrollTaxState> {
  const parsed = taxBracketSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.taxBracket.update({
    where: { id },
    data: {
      order: data.order,
      minIncome: data.minIncome,
      maxIncome: parseOptionalNumber(data.maxIncome),
      ratePercent: data.ratePercent,
    },
  })
  await logPayrollTax("lapisan tarif PPh 21")
  revalidatePath(PATH)
  return undefined
}

export async function deleteTaxBracketAction(id: number) {
  await prisma.taxBracket.delete({ where: { id } })
  await logPayrollTax("lapisan tarif PPh 21")
  revalidatePath(PATH)
}
