import ExcelJS from "exceljs"

import type { IzinMonitoringRow } from "@/lib/izin-monitoring"
import { izinStatusLabel } from "@/components/riwayat-izin-content"

const COMPANY_NAME = "PERUMDA BANK GRESIK"

const HEADERS = [
  "No",
  "Tanggal Pengajuan",
  "Jenis Izin",
  "Nama Pegawai",
  "NIP",
  "Bagian",
  "Tanggal Izin",
  "Keterangan",
  "Status",
]

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export async function buildIzinMonitoringWorkbook(
  rows: IzinMonitoringRow[],
  rangeLabel: string
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRM"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Monitoring Izin")
  const lastCol = HEADERS.length

  sheet.mergeCells(1, 1, 1, lastCol)
  sheet.getCell(1, 1).value = "MONITORING IZIN & CUTI"
  sheet.mergeCells(2, 1, 2, lastCol)
  sheet.getCell(2, 1).value = COMPANY_NAME
  sheet.mergeCells(3, 1, 3, lastCol)
  sheet.getCell(3, 1).value = rangeLabel
  for (const row of [1, 2, 3]) {
    const cell = sheet.getCell(row, 1)
    cell.font = { bold: true, size: row === 1 ? 13 : 11 }
    cell.alignment = { horizontal: "center" }
  }

  const headerRow = sheet.getRow(5)
  HEADERS.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    cell.font = { bold: true }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    }
  })
  headerRow.height = 26

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(6 + index)
    const values = [
      index + 1,
      formatDate(row.requestedAt),
      row.type,
      row.employeeName,
      row.employeeNumber,
      row.departmentName,
      row.date,
      row.summary,
      izinStatusLabel(row.kind, row.status, row.pendingSecondaryStep),
    ]
    values.forEach((value, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1)
      cell.value = value
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      }
    })
  })

  sheet.columns = [
    { width: 5 },
    { width: 16 },
    { width: 26 },
    { width: 24 },
    { width: 14 },
    { width: 20 },
    { width: 24 },
    { width: 36 },
    { width: 16 },
  ]
  sheet.views = [{ state: "frozen", ySplit: 5 }]

  return workbook
}
