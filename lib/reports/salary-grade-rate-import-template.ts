import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"

const HEADERS = ["Golongan*", "Ruang*", "MKG*", "Nominal Gaji Pokok*"]
const EXAMPLE_ROW = ["C", "1", "0", "2579400"]
const COLUMN_WIDTHS = [14, 10, 10, 20]

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true }
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  cell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  }
}

function styleDataCell(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  }
}

// Sheet kedua isinya daftar kombinasi Golongan-Ruang yang SUDAH ADA di
// Struktur & Golongan Gaji — dipakai sebagai acuan supaya admin mengetik
// Golongan/Ruang yang persis sama (pencocokan saat import berdasarkan nama,
// case-insensitive, bukan ID; lihat importSalaryGradeRatesAction).
async function buildReferenceSheet(workbook: ExcelJS.Workbook) {
  const grades = await prisma.salaryGrade.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }, { subGrade: "asc" }],
  })

  const sheet = workbook.addWorksheet("Referensi")
  const headerRow = sheet.getRow(1)
  ;["Golongan", "Ruang"].forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    styleHeaderCell(cell)
  })
  grades.forEach((g, i) => {
    sheet.getRow(2 + i).getCell(1).value = g.code
    sheet.getRow(2 + i).getCell(2).value = g.subGrade
  })
  sheet.columns = [{ width: 14 }, { width: 10 }]
}

export async function buildSalaryGradeRateImportTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Tabel Gaji Pokok")

  const headerRow = sheet.getRow(1)
  HEADERS.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    styleHeaderCell(cell)
  })
  headerRow.height = 24

  const exampleRow = sheet.getRow(2)
  EXAMPLE_ROW.forEach((value, index) => {
    const cell = exampleRow.getCell(index + 1)
    cell.value = value
    styleDataCell(cell)
  })

  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }))

  await buildReferenceSheet(workbook)

  return workbook
}
