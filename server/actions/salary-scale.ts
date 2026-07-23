"use server"

import { revalidatePath } from "next/cache"
import ExcelJS from "exceljs"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { salaryScaleVersionSchema } from "@/lib/validations/salary-scale"

export type SalaryScaleVersionState = { error?: string } | undefined

export type ImportSalaryGradeRateState =
  | { success: true; imported: number; errors: string[]; createdGrades: string[] }
  | { success: false; error: string }
  | undefined

const PATH = "/admin/payroll/struktur-gaji"

async function logVersion(action: string, label: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "SalaryScaleVersion",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } versi skala gaji "${label}".`,
  })
}

export async function createSalaryScaleVersionAction(
  _prevState: SalaryScaleVersionState,
  formData: FormData
): Promise<SalaryScaleVersionState> {
  const parsed = salaryScaleVersionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.salaryScaleVersion.create({
    data: {
      name: data.name,
      effectiveDate: new Date(data.effectiveDate),
    },
  })
  await logVersion("CREATE", data.name)

  revalidatePath(PATH)
  return undefined
}

export async function updateSalaryScaleVersionAction(
  id: number,
  _prevState: SalaryScaleVersionState,
  formData: FormData
): Promise<SalaryScaleVersionState> {
  const parsed = salaryScaleVersionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  await prisma.salaryScaleVersion.update({
    where: { id },
    data: {
      name: data.name,
      effectiveDate: new Date(data.effectiveDate),
    },
  })
  await logVersion("UPDATE", data.name)

  revalidatePath(PATH)
  return undefined
}

// Cuma boleh ada SATU versi aktif dalam satu waktu (lihat catatan di
// schema.prisma pada SalaryScaleVersion) — mengaktifkan satu versi otomatis
// menonaktifkan semua versi lain lewat transaksi.
export async function toggleSalaryScaleVersionActiveAction(id: number, isActive: boolean) {
  const version = await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.salaryScaleVersion.updateMany({
        where: { id: { not: id }, isActive: true },
        data: { isActive: false },
      })
    }
    return tx.salaryScaleVersion.update({ where: { id }, data: { isActive } })
  })
  await logVersion("UPDATE", version.name)
  revalidatePath(PATH)
}

export async function deleteSalaryScaleVersionAction(id: number) {
  const version = await prisma.salaryScaleVersion.findUnique({ where: { id } })
  if (!version) return
  await prisma.salaryScaleVersion.delete({ where: { id } })
  await logVersion("DELETE", version.name)
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

// Import massal isi tabel gaji pokok (Golongan, Ruang, MKG, Nominal) untuk
// satu versi PP. Kombinasi Golongan+Ruang yang BELUM ADA di Struktur &
// Golongan Gaji OTOMATIS dibuatkan (minSalary/maxSalary diambil dari nilai
// terendah/tertinggi di file ini) — jadi admin cukup import satu file tanpa
// perlu bikin golongan satu-satu dulu. Golongan yang SUDAH ADA sengaja
// TIDAK ditimpa minSalary/maxSalary-nya (biar tidak diam-diam mengubah data
// yang mungkin sudah disesuaikan manual). Setiap baris rate di-upsert
// berdasarkan unique [versionId, salaryGradeId, step], jadi import ulang
// file yang sama/sudah direvisi aman (menimpa, bukan duplikat).
export async function importSalaryGradeRatesAction(
  _prevState: ImportSalaryGradeRateState,
  formData: FormData
): Promise<ImportSalaryGradeRateState> {
  const versionId = Number(formData.get("versionId"))
  if (!versionId) {
    return { success: false, error: "Versi skala gaji tidak valid." }
  }

  const version = await prisma.salaryScaleVersion.findUnique({ where: { id: versionId } })
  if (!version) {
    return { success: false, error: "Versi skala gaji tidak ditemukan." }
  }

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

  const sheet = workbook.getWorksheet("Tabel Gaji Pokok") ?? workbook.worksheets[0]
  if (!sheet) {
    return { success: false, error: "File Excel tidak memiliki sheet data." }
  }

  const errors: string[] = []
  const parsedRows: { code: string; subGrade: string; step: number; amount: number }[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // header
    const code = cellText(row.getCell(1).value)
    const subGrade = cellText(row.getCell(2).value)
    const step = cellNumber(row.getCell(3).value)
    const amount = cellNumber(row.getCell(4).value)
    if (!code && !subGrade && step === null && amount === null) return // baris kosong

    if (!code || !subGrade) {
      errors.push(`Baris ${rowNumber}: Golongan/Ruang wajib diisi.`)
      return
    }
    if (step === null || step < 0) {
      errors.push(`Baris ${rowNumber}: MKG tidak valid.`)
      return
    }
    if (amount === null || amount < 0) {
      errors.push(`Baris ${rowNumber}: Nominal tidak valid.`)
      return
    }

    parsedRows.push({ code: code.trim(), subGrade: subGrade.trim(), step, amount })
  })

  if (parsedRows.length === 0) {
    return { success: false, error: errors[0] ?? "Tidak ada baris data yang valid di file ini." }
  }

  const existingGrades = await prisma.salaryGrade.findMany()
  const gradeMap = new Map(
    existingGrades.map((g) => [`${g.code.toLowerCase()}-${g.subGrade.toLowerCase()}`, g.id])
  )
  const maxDisplayOrder = existingGrades.reduce((max, g) => Math.max(max, g.displayOrder), -1)

  // Kumpulkan kombinasi Golongan+Ruang yang belum terdaftar, plus rentang
  // nilai (min/max) dari file ini buat dijadikan minSalary/maxSalary awal.
  const newGrades = new Map<string, { code: string; subGrade: string; min: number; max: number }>()
  for (const row of parsedRows) {
    const key = `${row.code.toLowerCase()}-${row.subGrade.toLowerCase()}`
    if (gradeMap.has(key)) continue
    const existing = newGrades.get(key)
    if (existing) {
      existing.min = Math.min(existing.min, row.amount)
      existing.max = Math.max(existing.max, row.amount)
    } else {
      newGrades.set(key, { code: row.code, subGrade: row.subGrade, min: row.amount, max: row.amount })
    }
  }

  const newGradeList = Array.from(newGrades.values()).sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code)
    if (codeCompare !== 0) return codeCompare
    return a.subGrade.localeCompare(b.subGrade, undefined, { numeric: true })
  })

  const createdGrades: string[] = []
  await prisma.$transaction(async (tx) => {
    for (const [index, grade] of newGradeList.entries()) {
      const created = await tx.salaryGrade.create({
        data: {
          code: grade.code,
          subGrade: grade.subGrade,
          minSalary: grade.min,
          maxSalary: grade.max,
          displayOrder: maxDisplayOrder + 1 + index,
        },
      })
      gradeMap.set(`${grade.code.toLowerCase()}-${grade.subGrade.toLowerCase()}`, created.id)
      createdGrades.push(`${grade.code}-${grade.subGrade}`)
    }
  })

  const rows = parsedRows.map((row) => ({
    salaryGradeId: gradeMap.get(`${row.code.toLowerCase()}-${row.subGrade.toLowerCase()}`)!,
    step: row.step,
    amount: row.amount,
  }))

  await prisma.$transaction(
    rows.map((row) =>
      prisma.salaryGradeRate.upsert({
        where: {
          versionId_salaryGradeId_step: {
            versionId,
            salaryGradeId: row.salaryGradeId,
            step: row.step,
          },
        },
        create: { versionId, salaryGradeId: row.salaryGradeId, step: row.step, amount: row.amount },
        update: { amount: row.amount },
      })
    )
  )

  await logVersion(
    "UPDATE",
    `${version.name} (import ${rows.length} baris rate, ${createdGrades.length} golongan baru)`
  )
  revalidatePath(PATH)
  revalidatePath(`${PATH}/skala-pp/${versionId}`)

  return { success: true, imported: rows.length, errors, createdGrades }
}
