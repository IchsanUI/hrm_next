"use server"

import { revalidatePath } from "next/cache"
import ExcelJS from "exceljs"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import {
  bpjsSettingsSchema,
  pph21MethodSchema,
  ptkpRatesSchema,
  taxBracketSchema,
  terRateSchema,
  TER_CATEGORIES,
  PTKP_STATUSES,
} from "@/lib/validations/payroll-tax"

export type PayrollTaxState = { error?: string } | undefined
export type ImportTerRateState =
  | { success: true; imported: number; categories: string[]; errors: string[] }
  | { success: false; error: string }
  | undefined

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

export async function updatePph21MethodAction(
  _prevState: PayrollTaxState,
  formData: FormData
): Promise<PayrollTaxState> {
  const parsed = pph21MethodSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  await prisma.bpjsSettings.upsert({
    where: { id: 1 },
    update: { pph21Method: parsed.data.pph21Method },
    create: { id: 1, pph21Method: parsed.data.pph21Method },
  })
  await logPayrollTax("metode perhitungan PPh 21")
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

export async function createTerRateAction(
  _prevState: PayrollTaxState,
  formData: FormData
): Promise<PayrollTaxState> {
  const parsed = terRateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.terRate.create({
    data: {
      category: data.category,
      order: data.order,
      minIncome: data.minIncome,
      maxIncome: parseOptionalNumber(data.maxIncome),
      ratePercent: data.ratePercent,
    },
  })
  await logPayrollTax("tarif TER")
  revalidatePath(PATH)
  return undefined
}

export async function updateTerRateAction(
  id: number,
  _prevState: PayrollTaxState,
  formData: FormData
): Promise<PayrollTaxState> {
  const parsed = terRateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.terRate.update({
    where: { id },
    data: {
      category: data.category,
      order: data.order,
      minIncome: data.minIncome,
      maxIncome: parseOptionalNumber(data.maxIncome),
      ratePercent: data.ratePercent,
    },
  })
  await logPayrollTax("tarif TER")
  revalidatePath(PATH)
  return undefined
}

export async function deleteTerRateAction(id: number) {
  await prisma.terRate.delete({ where: { id } })
  await logPayrollTax("tarif TER")
  revalidatePath(PATH)
}

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (typeof raw === "object" && "text" in raw) return String((raw as { text: unknown }).text ?? "").trim()
  return String(raw).trim()
}

function cellNumber(raw: unknown): number | null {
  if (typeof raw === "number") return raw
  const text = cellText(raw).replace(/[^\d.-]/g, "")
  if (!text) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

// Import massal tarif TER dari Excel (template:
// /api/master-data/tarif-ter/template). Semantik REPLACE per kategori —
// import ulang file untuk kategori yang sama akan MENGHAPUS semua tarif
// lama kategori itu lalu menggantinya dengan isi file (bukan menambah,
// biar tidak dobel/nyampur sisa data lama & baru), jadi aman dipakai untuk
// revisi tarif. Kategori LAIN yang tidak ada di file ini tidak disentuh.
export async function importTerRatesAction(
  _prevState: ImportTerRateState,
  formData: FormData
): Promise<ImportTerRateState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Pilih file Excel terlebih dahulu." }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await file.arrayBuffer())
  } catch {
    return { success: false, error: "File tidak bisa dibaca. Pastikan formatnya .xlsx sesuai template." }
  }

  const sheet = workbook.getWorksheet("Tarif TER") ?? workbook.worksheets[0]
  if (!sheet) {
    return { success: false, error: "File Excel tidak memiliki sheet data." }
  }

  const errors: string[] = []
  const parsedRows: {
    category: (typeof TER_CATEGORIES)[number]
    order: number
    minIncome: number
    maxIncome: number | null
    ratePercent: number
  }[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // header
    const categoryRaw = cellText(row.getCell(1).value).toUpperCase()
    const orderRaw = cellNumber(row.getCell(2).value)
    const minIncome = cellNumber(row.getCell(3).value)
    const maxIncome = cellNumber(row.getCell(4).value)
    const ratePercent = cellNumber(row.getCell(5).value)
    if (!categoryRaw && minIncome === null && ratePercent === null) return // baris kosong

    if (!TER_CATEGORIES.includes(categoryRaw as (typeof TER_CATEGORIES)[number])) {
      errors.push(`Baris ${rowNumber}: Kategori "${categoryRaw}" tidak valid (harus A, B, atau C).`)
      return
    }
    if (minIncome === null || minIncome < 0) {
      errors.push(`Baris ${rowNumber}: Bruto Dari tidak valid.`)
      return
    }
    if (ratePercent === null || ratePercent < 0) {
      errors.push(`Baris ${rowNumber}: Tarif TER tidak valid.`)
      return
    }
    if (maxIncome !== null && maxIncome <= minIncome) {
      errors.push(`Baris ${rowNumber}: Bruto Sampai harus lebih besar dari Bruto Dari.`)
      return
    }

    parsedRows.push({
      category: categoryRaw as (typeof TER_CATEGORIES)[number],
      order: orderRaw ?? 0,
      minIncome,
      maxIncome,
      ratePercent,
    })
  })

  if (parsedRows.length === 0) {
    return { success: false, error: errors[0] ?? "Tidak ada baris data yang valid di file ini." }
  }

  const categoriesInFile = Array.from(new Set(parsedRows.map((r) => r.category)))

  await prisma.$transaction([
    prisma.terRate.deleteMany({ where: { category: { in: categoriesInFile } } }),
    prisma.terRate.createMany({ data: parsedRows }),
  ])

  await logPayrollTax(`tarif TER (import ${categoriesInFile.join(", ")})`)
  revalidatePath(PATH)
  return { success: true, imported: parsedRows.length, categories: categoriesInFile, errors }
}
