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

// "bulan" query param formatnya yyyy-MM (dari <input type="month">, lihat
// components/report-month-dialog.tsx) — PayrollPeriod.year/month adalah
// bulan PEMBAYARAN (bukan tanggal cut-off 21-20), jadi resolve LANGSUNG ke
// baris PayrollPeriod itu, bukan hitung ulang rentang tanggal sendiri.
export function parseBulanToYearMonth(bulan: string | null): { year: number; month: number } | null {
  if (!bulan) return null
  const [yearStr, monthStr] = bulan.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

export type AttendanceSalaryReportResult =
  | { error: string }
  | { workbook: ExcelJS.Workbook; periodLabel: string }

// Laporan "Data Kehadiran Pegawai" — Nama, No HP, dan Gaji Kehadiran (nilai
// TUNJANGAN KEHADIRAN, bukan gaji penuh) per pegawai untuk SATU periode
// payroll yang SUDAH digenerate. SENGAJA ambil dari PayslipItem yang sudah
// tersimpan (snapshot hasil generate slip gaji), BUKAN hitung ulang lewat
// lib/payroll/attendance-allowance.ts — supaya angkanya PERSIS sama dengan
// yang sungguhan dibayarkan (attendance-allowance.ts punya banyak aturan
// per-jenis-izin yang bisa berubah setelahnya lewat Pengaturan Izin, jadi
// hasil hitung ulang bisa beda dari yang sudah di-lock).
export async function buildAttendanceSalaryWorkbook(
  yearMonth: { year: number; month: number }
): Promise<AttendanceSalaryReportResult> {
  const period = await prisma.payrollPeriod.findFirst({
    where: { year: yearMonth.year, month: yearMonth.month },
  })
  if (!period) {
    return { error: "Belum ada periode payroll yang digenerate untuk bulan ini." }
  }

  const payslips = await prisma.payslip.findMany({
    where: { payrollPeriodId: period.id },
    include: {
      employee: { select: { fullName: true, phone: true } },
      items: {
        where: {
          category: { in: ["PENDAPATAN_TETAP", "PENDAPATAN_TIDAK_TETAP"] },
          salaryComponent: { calculationType: "KEHADIRAN" },
        },
        select: { amount: true },
      },
    },
    orderBy: { employee: { fullName: "asc" } },
  })

  const periodLabel = new Date(period.year, period.month - 1, 1)
    .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    .toUpperCase()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet("Data Kehadiran Pegawai")

  sheet.mergeCells(1, 1, 1, 4)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `DATA KEHADIRAN PEGAWAI — ${periodLabel}`
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: "center" }

  const HEADERS = ["NO", "NAMA", "NO HP", "GAJI KEHADIRAN"]
  const HEADER_ROW = 3
  HEADERS.forEach((label, index) => {
    const cell = sheet.getCell(HEADER_ROW, index + 1)
    cell.value = label
    cell.font = { bold: true }
    cell.fill = HEADER_FILL
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = THIN_BORDER
  })

  payslips.forEach((payslip, index) => {
    const attendanceSalary = payslip.items.reduce((sum, item) => sum + item.amount, 0)
    const row = HEADER_ROW + 1 + index
    const values = [index + 1, payslip.employee.fullName, payslip.employee.phone, attendanceSalary]
    values.forEach((value, colIndex) => {
      const cell = sheet.getCell(row, colIndex + 1)
      cell.value = value
      cell.border = THIN_BORDER
      if (colIndex === 3) cell.numFmt = "#,##0"
      if (colIndex === 0 || colIndex === 3) cell.alignment = { horizontal: "center" }
    })
  })

  sheet.columns = [{ width: 6 }, { width: 32 }, { width: 18 }, { width: 20 }]

  return { workbook, periodLabel }
}
