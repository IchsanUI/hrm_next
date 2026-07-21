import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"
import type { MonthRange } from "@/lib/reports/attendance-kpi-report"

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2E8F0" },
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
}

function formatDateTime(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Ekspor APA ADANYA baris AttendanceLog yang sudah tersimpan lokal (bukan
// scraping baru, bukan agregat per-pegawai kayak Laporan Kehadiran) — buat
// kebutuhan audit/arsip data mentah. Return null kalau tidak ada satu pun
// baris di rentang tanggal itu, dipakai route buat kasih pesan "belum ada
// data" alih-alih file Excel kosong.
export async function buildAttendanceRawExportWorkbook(
  range: Pick<MonthRange, "start" | "end" | "label">
): Promise<ExcelJS.Workbook | null> {
  const logs = await prisma.attendanceLog.findMany({
    where: { logTime: { gte: range.start, lte: range.end } },
    orderBy: [{ logTime: "asc" }, { location: "asc" }],
  })
  if (logs.length === 0) return null

  const pins = Array.from(new Set(logs.map((l) => l.userPin)))
  const employees = await prisma.employee.findMany({
    where: { pinAttendance: { in: pins } },
    select: { pinAttendance: true, fullName: true },
  })
  const employeeByPin = new Map(employees.map((e) => [e.pinAttendance as string, e.fullName]))

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet("Data Absensi Mentah")

  sheet.mergeCells(1, 1, 1, 8)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `DATA ABSENSI MENTAH — ${range.label}`
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: "center" }

  const HEADER_ROW = 3
  const DATA_START_ROW = 4
  const headers = ["Waktu", "PIN", "Nama (Terhubung)", "Nama (Mesin)", "Lokasi", "Catatan", "Jenis", "Verifikasi"]
  headers.forEach((label, i) => {
    const cell = sheet.getCell(HEADER_ROW, i + 1)
    cell.value = label
    cell.font = { bold: true }
    cell.fill = HEADER_FILL
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = THIN_BORDER
  })

  logs.forEach((log, index) => {
    const rowNumber = DATA_START_ROW + index
    const values = [
      formatDateTime(log.logTime),
      log.userPin,
      employeeByPin.get(log.userPin) ?? "",
      log.name,
      log.location,
      log.note ?? "",
      log.logType,
      log.verifyType,
    ]
    values.forEach((value, colIndex) => {
      const cell = sheet.getCell(rowNumber, colIndex + 1)
      cell.value = value
      cell.border = THIN_BORDER
    })
  })

  sheet.columns = [
    { width: 20 },
    { width: 10 },
    { width: 26 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ]
  sheet.views = [{ state: "frozen", ySplit: DATA_START_ROW - 1 }]

  return workbook
}
