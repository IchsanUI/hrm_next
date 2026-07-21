import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"
import type { MonthRange } from "@/lib/reports/attendance-kpi-report"

// Laporan Kehadiran — beda dari Rekap Absen (KPI) yang sumbernya pengajuan
// izin (LateArrivalRequest/EarlyLeaveRequest). Laporan ini murni dari data
// mentah hasil scraping mesin fingerprint (AttendanceLog), termasuk kolom
// `note` yang sudah dihitung & disimpan saat sync (lihat
// lib/attendance/attendance-note.ts) — jadi tinggal dibaca, tidak dihitung
// ulang di sini.

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9E8FB" },
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
}

// WorkShift.checkInTime/checkOutTime cuma nyimpen jam (Time(0)) — konvensi
// proyek ini selalu ekstrak lewat UTC (lihat attendance-kpi-report.ts).
function shiftTimeToMinutes(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

// AttendanceLog.logTime timestamp asli, di-parse dari string device tanpa
// suffix Z (lihat lib/attendance/scraper.ts) — jadi diekstrak lewat jam
// lokal server, konsisten dengan lib/attendance/attendance-note.ts.
function logTimeToMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

type EmployeeAttendanceReportRow = {
  no: number
  nama: string
  bagian: string
  jabatan: string
  hadir: number
  terlambatJumlah: number
  terlambatMenit: number
  pulangCepatJumlah: number
  pulangCepatMenit: number
}

export async function buildAttendanceReportWorkbook(range: MonthRange): Promise<ExcelJS.Workbook> {
  const employees = await prisma.employee.findMany({
    where: { isDeleted: false, pinAttendance: { not: null } },
    select: {
      fullName: true,
      pinAttendance: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      workShift: { select: { checkInTime: true, checkOutTime: true } },
    },
    orderBy: { fullName: "asc" },
  })

  const pins = employees.map((e) => e.pinAttendance as string)
  const logs =
    pins.length > 0
      ? await prisma.attendanceLog.findMany({
          where: { userPin: { in: pins }, logTime: { gte: range.start, lte: range.end } },
          select: { userPin: true, logTime: true, logType: true, note: true },
        })
      : []

  const logsByPin = new Map<string, typeof logs>()
  for (const log of logs) {
    const arr = logsByPin.get(log.userPin)
    if (arr) arr.push(log)
    else logsByPin.set(log.userPin, [log])
  }

  const rows: EmployeeAttendanceReportRow[] = employees.map((employee, index) => {
    const pin = employee.pinAttendance as string
    const employeeLogs = logsByPin.get(pin) ?? []

    const hadirDays = new Set(employeeLogs.map((l) => dateKey(l.logTime)))

    let terlambatJumlah = 0
    let terlambatMenit = 0
    let pulangCepatJumlah = 0
    let pulangCepatMenit = 0

    for (const log of employeeLogs) {
      if (log.note === "Terlambat" && employee.workShift) {
        terlambatJumlah += 1
        terlambatMenit += Math.max(
          0,
          logTimeToMinutes(log.logTime) - shiftTimeToMinutes(employee.workShift.checkInTime)
        )
      } else if (log.note === "Pulang Cepat" && employee.workShift) {
        pulangCepatJumlah += 1
        pulangCepatMenit += Math.max(
          0,
          shiftTimeToMinutes(employee.workShift.checkOutTime) - logTimeToMinutes(log.logTime)
        )
      }
    }

    return {
      no: index + 1,
      nama: employee.fullName,
      bagian: employee.department.name,
      jabatan: employee.position.name,
      hadir: hadirDays.size,
      terlambatJumlah,
      terlambatMenit,
      pulangCepatJumlah,
      pulangCepatMenit,
    }
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet("Laporan Kehadiran")

  sheet.mergeCells(1, 1, 1, 9)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `LAPORAN KEHADIRAN — ${range.label}`
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: "center" }

  sheet.mergeCells(2, 1, 2, 9)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = "Sumber: data mentah hasil scraping mesin fingerprint (bukan pengajuan izin)"
  subtitleCell.font = { italic: true, size: 9, color: { argb: "FF6B7280" } }
  subtitleCell.alignment = { horizontal: "center" }

  const HEADER_ROW = 4
  const SUBHEADER_ROW = 5
  const DATA_START_ROW = 6

  function mergedHeader(row: number, fromCol: number, toCol: number, value: string, toRow = row) {
    sheet.mergeCells(row, fromCol, toRow, toCol)
    const cell = sheet.getCell(row, fromCol)
    cell.value = value
    cell.font = { bold: true }
    cell.fill = HEADER_FILL
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    for (let r = row; r <= toRow; r++) {
      for (let c = fromCol; c <= toCol; c++) {
        sheet.getCell(r, c).border = THIN_BORDER
      }
    }
  }

  mergedHeader(HEADER_ROW, 1, 1, "NO", SUBHEADER_ROW)
  mergedHeader(HEADER_ROW, 2, 2, "NAMA", SUBHEADER_ROW)
  mergedHeader(HEADER_ROW, 3, 3, "BAGIAN", SUBHEADER_ROW)
  mergedHeader(HEADER_ROW, 4, 4, "JABATAN", SUBHEADER_ROW)
  mergedHeader(HEADER_ROW, 5, 5, "HADIR (HARI)", SUBHEADER_ROW)
  mergedHeader(HEADER_ROW, 6, 7, "TERLAMBAT")
  mergedHeader(HEADER_ROW, 8, 9, "PULANG CEPAT")

  mergedHeader(SUBHEADER_ROW, 6, 6, "JUMLAH")
  mergedHeader(SUBHEADER_ROW, 7, 7, "TOTAL MENIT")
  mergedHeader(SUBHEADER_ROW, 8, 8, "JUMLAH")
  mergedHeader(SUBHEADER_ROW, 9, 9, "TOTAL MENIT")

  rows.forEach((row, index) => {
    const rowNumber = DATA_START_ROW + index
    const values = [
      row.no,
      row.nama,
      row.bagian,
      row.jabatan,
      row.hadir || "",
      row.terlambatJumlah || "",
      row.terlambatMenit || "",
      row.pulangCepatJumlah || "",
      row.pulangCepatMenit || "",
    ]
    values.forEach((value, colIndex) => {
      const cell = sheet.getCell(rowNumber, colIndex + 1)
      cell.value = value
      cell.border = THIN_BORDER
      if (colIndex >= 4) cell.alignment = { horizontal: "center" }
    })
  })

  if (rows.length === 0) {
    sheet.mergeCells(DATA_START_ROW, 1, DATA_START_ROW, 9)
    const emptyCell = sheet.getCell(DATA_START_ROW, 1)
    emptyCell.value = "Belum ada pegawai dengan PIN mesin absensi yang dipetakan."
    emptyCell.alignment = { horizontal: "center" }
    emptyCell.font = { italic: true, color: { argb: "FF6B7280" } }
  }

  sheet.columns = [
    { width: 5 },
    { width: 26 },
    { width: 20 },
    { width: 20 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
  ]
  sheet.views = [{ state: "frozen", ySplit: DATA_START_ROW - 1 }]

  return workbook
}
