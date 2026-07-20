"use server"

import { revalidatePath } from "next/cache"
import ExcelJS from "exceljs"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { nationalHolidaySchema } from "@/lib/validations/master-data"

export type MasterDataState = { error?: string; success?: boolean } | undefined

async function logHoliday(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "NationalHoliday",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } hari libur "${name}".`,
  })
}

export async function createNationalHolidayAction(
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = nationalHolidaySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan nama hari libur wajib diisi." }
  }
  await prisma.nationalHoliday.create({
    data: {
      date: new Date(parsed.data.date),
      name: parsed.data.name,
      isOfficeOpen: parsed.data.isOfficeOpen,
    },
  })
  await logHoliday("CREATE", parsed.data.name)
  revalidatePath("/admin/hari-libur")
  return { success: true }
}

export async function updateNationalHolidayAction(
  id: number,
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = nationalHolidaySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan nama hari libur wajib diisi." }
  }
  await prisma.nationalHoliday.update({
    where: { id },
    data: {
      date: new Date(parsed.data.date),
      name: parsed.data.name,
      isOfficeOpen: parsed.data.isOfficeOpen,
    },
  })
  await logHoliday("UPDATE", parsed.data.name)
  revalidatePath("/admin/hari-libur")
  return { success: true }
}

export async function deleteNationalHolidayAction(id: number) {
  const holiday = await prisma.nationalHoliday.findUnique({ where: { id } })
  await prisma.nationalHoliday.delete({ where: { id } })
  if (holiday) {
    await logHoliday("DELETE", holiday.name)
  }
  revalidatePath("/admin/hari-libur")
}

export type ImportHolidayState =
  | { error: string; success?: undefined }
  | { success: true; imported: number; skipped: number; errors: string[]; error?: undefined }
  | undefined

// Menerima tanggal dalam bentuk Date (Excel serial date otomatis dibaca
// ExcelJS sebagai Date) atau string "DD-MM-YYYY" / "YYYY-MM-DD".
function parseTemplateDate(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()))
  }
  if (typeof raw === "string") {
    const value = raw.trim()
    const ddmmyyyy = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
    }
    const yyyymmdd = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (yyyymmdd) {
      const [, y, m, d] = yyyymmdd
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
    }
  }
  return null
}

function parseTemplateOfficeOpen(raw: unknown): boolean {
  const value = String(raw ?? "").trim().toLowerCase()
  return value === "ya" || value === "yes" || value === "true"
}

export async function importNationalHolidaysAction(
  _prevState: ImportHolidayState,
  formData: FormData
): Promise<ImportHolidayState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file Excel terlebih dahulu." }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await file.arrayBuffer())
  } catch {
    return { error: "File tidak bisa dibaca. Pastikan formatnya .xlsx sesuai template." }
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return { error: "File Excel tidak memiliki sheet data." }
  }

  const errors: string[] = []
  const rows: { date: Date; name: string; isOfficeOpen: boolean }[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // header
    const dateCell = row.getCell(1).value
    const nameCell = row.getCell(2).value
    const officeOpenCell = row.getCell(3).value

    const isBlankRow = !dateCell && !nameCell
    if (isBlankRow) return

    const date = parseTemplateDate(dateCell)
    const name = typeof nameCell === "string" ? nameCell.trim() : String(nameCell ?? "").trim()

    if (!date) {
      errors.push(`Baris ${rowNumber}: tanggal tidak valid.`)
      return
    }
    if (!name) {
      errors.push(`Baris ${rowNumber}: nama hari libur wajib diisi.`)
      return
    }
    rows.push({ date, name, isOfficeOpen: parseTemplateOfficeOpen(officeOpenCell) })
  })

  if (rows.length === 0 && errors.length === 0) {
    return { error: "Tidak ada data hari libur pada file." }
  }

  let imported = 0
  let skipped = 0
  for (const row of rows) {
    const existing = await prisma.nationalHoliday.findFirst({ where: { date: row.date } })
    if (existing) {
      skipped += 1
      continue
    }
    await prisma.nationalHoliday.create({
      data: { date: row.date, name: row.name, isOfficeOpen: row.isOfficeOpen },
    })
    imported += 1
  }

  if (imported > 0) {
    const session = await auth()
    await logActivity({
      userId: session?.user.id ? Number(session.user.id) : null,
      username: session?.user.username ?? "system",
      action: "CREATE",
      entityType: "NationalHoliday",
      description: `${session?.user.username ?? "system"} mengimpor ${imported} hari libur dari Excel.`,
    })
    revalidatePath("/admin/hari-libur")
  }

  return { success: true, imported, skipped, errors }
}
