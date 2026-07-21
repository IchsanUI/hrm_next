import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"
import type { MonthRange } from "@/lib/reports/attendance-kpi-report"

const COMPANY_TITLE = "PERUMDA BPR BANK GRESIK"

const GROUP_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF8D7DA" },
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
}

const COLUMN_COUNT = 15 // NO..REK-TAB

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function lastDayOfMonth(range: MonthRange) {
  return range.end.getDate()
}

export async function buildOvertimeReportWorkbook(
  range: MonthRange,
  baseUrl: string
): Promise<ExcelJS.Workbook> {
  const requests = await prisma.overtimeRequest.findMany({
    where: {
      status: "COMPLETED",
      date: { gte: range.start, lte: range.end },
    },
    include: {
      employee: { select: { fullName: true, position: { select: { name: true } }, department: { select: { name: true } } } },
      proofs: { orderBy: { id: "asc" } },
    },
    orderBy: [{ employee: { department: { name: "asc" } } }, { date: "asc" }],
  })

  const groups = new Map<string, typeof requests>()
  for (const request of requests) {
    const departmentName = request.employee.department.name
    if (!groups.has(departmentName)) groups.set(departmentName, [])
    groups.get(departmentName)!.push(request)
  }
  const sortedDepartments = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet("Rekap Lembur")

  function mergedTitle(row: number, value: string, bold = true, size = 12) {
    sheet.mergeCells(row, 1, row, COLUMN_COUNT)
    const cell = sheet.getCell(row, 1)
    cell.value = value
    cell.font = { bold, size }
    cell.alignment = { horizontal: "center" }
  }

  mergedTitle(1, "REKAPITULASI LEMBUR PEGAWAI", true, 13)
  mergedTitle(2, COMPANY_TITLE, true, 12)
  mergedTitle(3, `BULAN ${range.label} (Sampai Dengan Tanggal ${lastDayOfMonth(range)})`, true, 11)

  const HEADER_LABELS = [
    "NO",
    "NAMA",
    "JABATAN",
    "TANGGAL",
    "JAM",
    "JML MENIT",
    "KETERANGAN",
    "LAMPIRAN",
    "TARIF",
    "RP",
    "TOTAL",
    "PAJAK",
    "+/-",
    "PENERIMAAN",
    "REK-TAB",
  ]
  const HEADER_ROW = 5
  HEADER_LABELS.forEach((label, index) => {
    const cell = sheet.getCell(HEADER_ROW, index + 1)
    cell.value = label
    cell.font = { bold: true }
    cell.fill = GROUP_FILL
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = THIN_BORDER
  })

  let row = HEADER_ROW + 1
  let totalMinutes = 0
  let runningNo = 0

  for (const departmentName of sortedDepartments) {
    sheet.mergeCells(row, 1, row, COLUMN_COUNT)
    const groupCell = sheet.getCell(row, 1)
    groupCell.value = departmentName.toUpperCase()
    groupCell.font = { bold: true }
    groupCell.fill = GROUP_FILL
    groupCell.alignment = { horizontal: "center" }
    row += 1

    for (const request of groups.get(departmentName)!) {
      runningNo += 1
      const minutes = request.actualHours ? Math.round(request.actualHours * 60) : 0
      totalMinutes += minutes

      const values: (string | number)[] = [
        runningNo,
        request.employee.fullName,
        request.employee.position.name,
        formatDate(request.date),
        request.actualStartTime && request.actualEndTime
          ? `${request.actualStartTime}-${request.actualEndTime}`
          : "-",
        minutes || "",
        request.task,
        "", // Lampiran diisi terpisah di bawah sebagai hyperlink
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]
      values.forEach((value, colIndex) => {
        const cell = sheet.getCell(row, colIndex + 1)
        cell.value = value
        cell.border = THIN_BORDER
        if (colIndex >= 2 && colIndex !== 6) cell.alignment = { horizontal: "center" }
      })

      const lampiranCell = sheet.getCell(row, 8)
      const firstProofUrl = request.proofs[0]?.url
      if (firstProofUrl) {
        const hyperlink = firstProofUrl.startsWith("/") ? `${baseUrl}${firstProofUrl}` : firstProofUrl
        const label = request.proofs.length > 1 ? `Lihat Bukti (${request.proofs.length} foto)` : "Lihat Bukti"
        lampiranCell.value = { text: label, hyperlink }
        lampiranCell.font = { color: { argb: "FF1155CC" }, underline: true }
      } else {
        lampiranCell.value = "-"
      }
      lampiranCell.alignment = { horizontal: "center" }
      lampiranCell.border = THIN_BORDER

      row += 1
    }

    row += 1 // baris kosong pemisah antar bagian
  }

  sheet.mergeCells(row, 1, row, 5)
  const totalLabelCell = sheet.getCell(row, 1)
  totalLabelCell.value = "TOTAL"
  totalLabelCell.font = { bold: true }
  totalLabelCell.fill = GROUP_FILL
  totalLabelCell.alignment = { horizontal: "center" }
  for (let c = 1; c <= 5; c++) sheet.getCell(row, c).border = THIN_BORDER

  const totalMinutesCell = sheet.getCell(row, 6)
  totalMinutesCell.value = totalMinutes
  totalMinutesCell.font = { bold: true }
  totalMinutesCell.fill = GROUP_FILL
  totalMinutesCell.alignment = { horizontal: "center" }
  totalMinutesCell.border = THIN_BORDER
  for (let c = 7; c <= COLUMN_COUNT; c++) {
    const cell = sheet.getCell(row, c)
    cell.fill = GROUP_FILL
    cell.border = THIN_BORDER
  }

  // Blok tanda tangan — nama sengaja dikosongkan (diisi manual saat cetak),
  // cuma label peran + garis tanda tangan yang dicetak otomatis.
  let signRow = row + 3
  sheet.getCell(signRow, 2).value = `Gresik ${formatDate(new Date())}`
  signRow += 1

  const signColumns: [string, number][] = [
    ["Dibuat,", 2],
    ["Diperiksa,", 7],
    ["Mengetahui/Menyetujui,", 11],
  ]
  for (const [label, col] of signColumns) {
    sheet.getCell(signRow, col).value = label
  }

  const roleRow = signRow + 5
  const ROLE_LABELS: [string, number][] = [
    ["Personalia", 2],
    ["Kabag Personalia & Umum", 7],
    ["Direktur Utama", 11],
  ]
  for (const [label, col] of ROLE_LABELS) {
    const cell = sheet.getCell(roleRow, col)
    cell.value = label
    cell.border = { top: { style: "thin" } }
  }

  sheet.columns = [
    { width: 5 },
    { width: 22 },
    { width: 14 },
    { width: 12 },
    { width: 13 },
    { width: 10 },
    { width: 26 },
    { width: 12 },
    { width: 9 },
    { width: 9 },
    { width: 10 },
    { width: 9 },
    { width: 7 },
    { width: 12 },
    { width: 10 },
  ]

  return workbook
}
