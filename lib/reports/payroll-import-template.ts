import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5D9F2" },
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
}

// Kolom komponen di header SENGAJA cuma nama-nya (bukan ID) — import
// (importPayslipsAction di server/actions/payroll-period.ts) mencocokkan
// balik header ini ke SalaryComponent aktif BY NAME (case-insensitive),
// BUKAN posisi kolom tetap. Kalau master data komponen berubah setelah
// template ini diunduh, import akan menolak dengan pesan jelas alih-alih
// salah taruh angka ke kolom yang salah.
export type PayrollImportTemplateResult =
  | { error: string }
  | { workbook: ExcelJS.Workbook; periodLabel: string }

export async function buildPayrollImportTemplateWorkbook(
  payrollPeriodId: number
): Promise<PayrollImportTemplateResult> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) {
    return { error: "Periode payroll tidak ditemukan." }
  }

  // Pegawai eligible — query SAMA PERSIS dengan generatePayslipsAction
  // (server/actions/payroll-period.ts), supaya daftar pegawai di template
  // konsisten dengan yang akan divalidasi saat import.
  const [employees, components] = await Promise.all([
    prisma.employee.findMany({
      where: {
        OR: [{ isActive: true, isDeleted: false }, { resignDate: { gte: period.periodStart } }],
      },
      select: { employeeNumber: true, fullName: true, position: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.salaryComponent.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      select: { name: true },
    }),
  ])

  const periodLabel = new Date(period.year, period.month - 1, 1)
    .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    .toUpperCase()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet("Import Payroll")

  const HEADERS = ["NIP", "Nama Pegawai", "Jabatan", ...components.map((c) => c.name), "PPh 21"]
  const HEADER_ROW = 1
  HEADERS.forEach((label, index) => {
    const cell = sheet.getCell(HEADER_ROW, index + 1)
    cell.value = label
    cell.font = { bold: true }
    cell.fill = HEADER_FILL
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = THIN_BORDER
  })
  sheet.getRow(HEADER_ROW).height = 28

  employees.forEach((employee, index) => {
    const row = HEADER_ROW + 1 + index
    const values = [employee.employeeNumber, employee.fullName, employee.position.name]
    values.forEach((value, colIndex) => {
      const cell = sheet.getCell(row, colIndex + 1)
      cell.value = value
      cell.border = THIN_BORDER
    })
    // Kolom nominal (komponen + PPh 21) dikosongkan (border saja) — HR isi manual.
    for (let col = 4; col <= HEADERS.length; col++) {
      sheet.getCell(row, col).border = THIN_BORDER
    }
  })

  sheet.columns = [
    { width: 14 },
    { width: 28 },
    { width: 22 },
    ...components.map(() => ({ width: 18 })),
    { width: 16 },
  ]

  return { workbook, periodLabel }
}
