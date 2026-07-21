import ExcelJS from "exceljs"
import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type AttendanceKpiEmployee = Prisma.EmployeeGetPayload<{
  include: { workShift: true }
}>

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

// Field WorkShift.checkInTime/checkOutTime cuma nyimpen jam (Time(0), tanpa
// makna zona waktu) — proyek ini sudah konsisten mengekstraknya via UTC
// (lihat formatTime() di halaman detail pegawai), jadi dipertahankan sama di
// sini biar tidak nyeleneh dari konvensi yang sudah ada.
function shiftTimeToMinutes(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

// arrivalConfirmedAt itu timestamp beneran (bukan Time(0)), jadi diekstrak
// pakai jam lokal server — konsisten sama cara tampilan lain di aplikasi ini
// memformat DateTime (toLocaleTimeString/toLocaleDateString).
function timestampToMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function parseHHmmToMinutes(value: string) {
  const [hh, mm] = value.split(":").map(Number)
  return hh * 60 + mm
}

export type MonthRange = { start: Date; end: Date; label: string }

// "bulan" query param formatnya yyyy-MM (dari <input type="month">).
export function resolveMonthRange(bulan: string | null): MonthRange {
  const now = new Date()
  const [yearStr, monthStr] = (bulan ?? "").split("-")
  const year = Number(yearStr) || now.getFullYear()
  const monthIndex = (Number(monthStr) || now.getMonth() + 1) - 1

  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
  const label = start
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase()

  return { start, end, label }
}

type EmployeeAttendanceRow = {
  no: number
  nama: string
  potongCuti: number
  suratKetDokter: number
  dispensasiSppd: number
  terlambatJumlah: number
  terlambatMenit: number
  pulangCepatJumlah: number
  pulangCepatMenit: number
  ijinKeluarJumlah: number
  ijinKeluarMenit: number
}

export async function buildAttendanceKpiWorkbook(range: MonthRange): Promise<ExcelJS.Workbook> {
  const employees = await prisma.employee.findMany({
    where: { isDeleted: false },
    include: { workShift: true },
    orderBy: { fullName: "asc" },
  })

  const employeeIds = employees.map((e) => e.id)
  const dateFilter = { gte: range.start, lte: range.end }

  const [cutiRequests, sickLeaveRequests, dispensationRequests, lateArrivalRequests, earlyLeaveRequests, officeExitRequests] =
    await Promise.all([
      prisma.cutiRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "APPROVED", startDate: dateFilter },
        select: { employeeId: true },
      }),
      prisma.sickLeaveRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "APPROVED", startDate: dateFilter },
        select: { employeeId: true },
      }),
      prisma.dispensationRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "APPROVED", startDate: dateFilter },
        select: { employeeId: true },
      }),
      prisma.lateArrivalRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "APPROVED", createdAt: dateFilter },
        select: { employeeId: true, arrivalConfirmedAt: true },
      }),
      prisma.earlyLeaveRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "APPROVED", createdAt: dateFilter },
        select: { employeeId: true, plannedLeaveTime: true },
      }),
      prisma.officeExitRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "APPROVED", createdAt: dateFilter },
        select: { employeeId: true },
      }),
    ])

  function countBy(rows: { employeeId: number }[]) {
    const map = new Map<number, number>()
    for (const row of rows) {
      map.set(row.employeeId, (map.get(row.employeeId) ?? 0) + 1)
    }
    return map
  }

  const cutiCount = countBy(cutiRequests)
  const sickCount = countBy(sickLeaveRequests)
  const dispensationCount = countBy(dispensationRequests)
  const officeExitCount = countBy(officeExitRequests)

  const lateCount = new Map<number, number>()
  const lateMinutes = new Map<number, number>()
  for (const request of lateArrivalRequests) {
    lateCount.set(request.employeeId, (lateCount.get(request.employeeId) ?? 0) + 1)
    const employee = employees.find((e) => e.id === request.employeeId)
    if (request.arrivalConfirmedAt && employee?.workShift) {
      const late =
        timestampToMinutes(request.arrivalConfirmedAt) -
        shiftTimeToMinutes(employee.workShift.checkInTime)
      if (late > 0) {
        lateMinutes.set(request.employeeId, (lateMinutes.get(request.employeeId) ?? 0) + late)
      }
    }
  }

  const earlyCount = new Map<number, number>()
  const earlyMinutes = new Map<number, number>()
  for (const request of earlyLeaveRequests) {
    earlyCount.set(request.employeeId, (earlyCount.get(request.employeeId) ?? 0) + 1)
    const employee = employees.find((e) => e.id === request.employeeId)
    if (employee?.workShift) {
      const early =
        shiftTimeToMinutes(employee.workShift.checkOutTime) -
        parseHHmmToMinutes(request.plannedLeaveTime)
      if (early > 0) {
        earlyMinutes.set(request.employeeId, (earlyMinutes.get(request.employeeId) ?? 0) + early)
      }
    }
  }

  const rows: EmployeeAttendanceRow[] = employees.map((employee, index) => {
    const potongCuti = cutiCount.get(employee.id) ?? 0
    const suratKetDokter = sickCount.get(employee.id) ?? 0
    const dispensasiSppd = dispensationCount.get(employee.id) ?? 0
    return {
      no: index + 1,
      nama: employee.fullName,
      potongCuti,
      suratKetDokter,
      dispensasiSppd,
      terlambatJumlah: lateCount.get(employee.id) ?? 0,
      terlambatMenit: lateMinutes.get(employee.id) ?? 0,
      pulangCepatJumlah: earlyCount.get(employee.id) ?? 0,
      pulangCepatMenit: earlyMinutes.get(employee.id) ?? 0,
      ijinKeluarJumlah: officeExitCount.get(employee.id) ?? 0,
      ijinKeluarMenit: 0, // OfficeExitRequest belum menyimpan durasi kembali — belum bisa dihitung
    }
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet("Rekap Absen KPI")

  sheet.mergeCells(1, 1, 1, 14)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = range.label
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: "center" }

  const HEADER_ROW = 3
  const SUBHEADER_ROW = 4
  const SUBSUBHEADER_ROW = 5
  const DATA_START_ROW = 6

  function mergedHeader(
    row: number,
    fromCol: number,
    toCol: number,
    value: string,
    toRow = row
  ) {
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

  mergedHeader(HEADER_ROW, 1, 1, "NO", SUBSUBHEADER_ROW)
  mergedHeader(HEADER_ROW, 2, 2, "NAMA", SUBSUBHEADER_ROW)
  mergedHeader(HEADER_ROW, 3, 6, "TIDAK MASUK")
  mergedHeader(HEADER_ROW, 7, 9, "TERLAMBAT")
  mergedHeader(HEADER_ROW, 10, 11, "PULANG CEPAT")
  mergedHeader(HEADER_ROW, 12, 13, "IJIN MENINGGALKAN KANTOR")
  mergedHeader(HEADER_ROW, 14, 14, "KETERANGAN", SUBSUBHEADER_ROW)

  mergedHeader(SUBHEADER_ROW, 3, 3, "POTONG CUTI", SUBSUBHEADER_ROW)
  mergedHeader(SUBHEADER_ROW, 4, 4, "SURAT KET. DOKTER", SUBSUBHEADER_ROW)
  mergedHeader(SUBHEADER_ROW, 5, 5, "DISPENSASI/SPPD", SUBSUBHEADER_ROW)
  mergedHeader(SUBHEADER_ROW, 6, 6, "JUMLAH", SUBSUBHEADER_ROW)
  mergedHeader(SUBHEADER_ROW, 7, 9, "JUMLAH")
  mergedHeader(SUBHEADER_ROW, 10, 10, "JUMLAH", SUBSUBHEADER_ROW)
  mergedHeader(SUBHEADER_ROW, 11, 11, "MENIT", SUBSUBHEADER_ROW)
  mergedHeader(SUBHEADER_ROW, 12, 12, "JUMLAH", SUBSUBHEADER_ROW)
  mergedHeader(SUBHEADER_ROW, 13, 13, "MENIT", SUBSUBHEADER_ROW)

  mergedHeader(SUBSUBHEADER_ROW, 7, 7, "IJIN (X)")
  mergedHeader(SUBSUBHEADER_ROW, 8, 8, "TIDAK IJIN (X)")
  mergedHeader(SUBSUBHEADER_ROW, 9, 9, "MENIT")

  rows.forEach((row, index) => {
    const rowNumber = DATA_START_ROW + index
    const values = [
      row.no,
      row.nama,
      row.potongCuti || "",
      row.suratKetDokter || "",
      row.dispensasiSppd || "",
      row.potongCuti + row.suratKetDokter + row.dispensasiSppd || "",
      row.terlambatJumlah || "",
      "", // Tidak Ijin (X) — belum ada sumber data absensi mentah, sengaja dikosongkan
      row.terlambatMenit || "",
      row.pulangCepatJumlah || "",
      row.pulangCepatMenit || "",
      row.ijinKeluarJumlah || "",
      row.ijinKeluarMenit || "",
      "",
    ]
    values.forEach((value, colIndex) => {
      const cell = sheet.getCell(rowNumber, colIndex + 1)
      cell.value = value
      cell.border = THIN_BORDER
      if (colIndex >= 2) cell.alignment = { horizontal: "center" }
    })
  })

  sheet.columns = [
    { width: 5 },
    { width: 26 },
    { width: 11 },
    { width: 13 },
    { width: 13 },
    { width: 9 },
    { width: 9 },
    { width: 11 },
    { width: 8 },
    { width: 9 },
    { width: 8 },
    { width: 9 },
    { width: 8 },
    { width: 30 },
  ]
  sheet.views = [{ state: "frozen", ySplit: DATA_START_ROW - 1 }]

  return workbook
}
