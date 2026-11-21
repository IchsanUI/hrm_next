import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"
import type { MonthRange } from "@/lib/reports/attendance-kpi-report"
import { signWorkbook } from "@/lib/app-signature"
import { BOOKING_STATUS_LABEL } from "@/lib/vehicle-booking-labels"

// Rekap Kendaraan Dinas per bulan (berdasarkan waktu mulai booking):
// 1. Rincian Booking — satu baris per booking, semua status.
// 2. Rekap per Mobil — pemakaian (selesai), jam, dan jarak tempuh.
// 3. Rekap per Pemohon — jumlah booking per status & jarak tempuh.
// Tanggal ditulis sebagai teks WIB (bukan Date Excel) agar tidak bergeser zona waktu.

const COMPANY_TITLE = "PERUMDA BPR BANK GRESIK"
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
}

const TZ = "Asia/Jakarta"
function fmtDateTime(date: Date | null) {
  if (!date) return ""
  return date.toLocaleString("id-ID", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
function hoursBetween(start: Date, end: Date) {
  return Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10
}

type Column = { header: string; key: string; width: number; numFmt?: string }

function addTable(sheet: ExcelJS.Worksheet, title: string, subtitle: string, columns: Column[], rows: Record<string, unknown>[], totals?: Record<string, unknown>) {
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }))
  const lastCol = columns.length

  sheet.mergeCells(1, 1, 1, lastCol)
  sheet.getCell(1, 1).value = COMPANY_TITLE
  sheet.getCell(1, 1).font = { bold: true, size: 12 }
  sheet.mergeCells(2, 1, 2, lastCol)
  sheet.getCell(2, 1).value = title
  sheet.getCell(2, 1).font = { bold: true, size: 14 }
  sheet.mergeCells(3, 1, 3, lastCol)
  sheet.getCell(3, 1).value = subtitle
  sheet.getCell(3, 1).font = { italic: true, color: { argb: "FF6B7280" } }

  const headerRow = sheet.getRow(5)
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = HEADER_FILL
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = THIN_BORDER
  })
  headerRow.height = 30

  rows.forEach((data, r) => {
    const row = sheet.getRow(6 + r)
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = (data[c.key] ?? "") as ExcelJS.CellValue
      cell.border = THIN_BORDER
      cell.alignment = { vertical: "top", wrapText: true }
      if (c.numFmt) cell.numFmt = c.numFmt
    })
  })

  if (totals) {
    const row = sheet.getRow(6 + rows.length)
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = (totals[c.key] ?? "") as ExcelJS.CellValue
      cell.font = { bold: true }
      cell.fill = TOTAL_FILL
      cell.border = THIN_BORDER
      if (c.numFmt) cell.numFmt = c.numFmt
    })
  }

  sheet.views = [{ state: "frozen", ySplit: 5 }]
  if (rows.length) sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: lastCol } }
}

export async function buildVehicleBookingReportWorkbook(range: MonthRange): Promise<{ workbook: ExcelJS.Workbook; count: number }> {
  const bookings = await prisma.vehicleBooking.findMany({
    where: { startAt: { gte: range.start, lte: range.end } },
    orderBy: { startAt: "asc" },
    include: {
      vehicle: { select: { id: true, name: true, plateNumber: true, workLocation: { select: { name: true } } } },
      requester: {
        select: { id: true, fullName: true, employeeNumber: true, position: { select: { name: true } }, department: { select: { name: true } } },
      },
      driver: { select: { fullName: true } },
      handledBy: { select: { fullName: true } },
    },
  })

  const workbook = new ExcelJS.Workbook()
  signWorkbook(workbook)
  workbook.created = new Date()
  const subtitle = `Periode ${range.label} (berdasarkan waktu mulai booking) · dicetak ${fmtDateTime(new Date())} WIB`

  // ── Sheet 1: rincian
  const distanceOf = (b: (typeof bookings)[number]) =>
    b.status === "SELESAI" && b.startKm !== null && b.endKm !== null ? b.endKm - b.startKm : null

  const detailRows = bookings.map((b, i) => ({
    no: i + 1,
    bookingNumber: b.bookingNumber,
    createdAt: fmtDateTime(b.createdAt),
    requester: b.requester.fullName,
    nip: b.requester.employeeNumber,
    department: b.requester.department.name,
    position: b.requester.position.name,
    vehicle: b.vehicle.name,
    plate: b.vehicle.plateNumber,
    location: b.vehicle.workLocation.name,
    startAt: fmtDateTime(b.startAt),
    endAt: fmtDateTime(b.endAt),
    hours: hoursBetween(b.startAt, b.endAt),
    destination: b.destination,
    purpose: b.purpose,
    passengers: b.passengerCount,
    driver: b.driver?.fullName ?? (b.needsDriver ? "Diminta (belum ditugaskan)" : "Menyetir sendiri"),
    status: BOOKING_STATUS_LABEL[b.status],
    handledBy: b.handledBy?.fullName ?? "",
    handledAt: fmtDateTime(b.handledAt),
    note:
      b.status === "DITOLAK"
        ? `Ditolak: ${b.rejectionReason ?? "-"}`
        : b.status === "DIBATALKAN"
          ? `Dibatalkan${b.cancelReason ? `: ${b.cancelReason}` : " oleh pemohon"}`
          : (b.handlerNote ?? ""),
    departedAt: fmtDateTime(b.departedAt),
    startKm: b.startKm ?? "",
    returnedAt: fmtDateTime(b.returnedAt),
    endKm: b.endKm ?? "",
    distance: distanceOf(b) ?? "",
    returnNote: b.returnNote ?? "",
  }))

  addTable(
    workbook.addWorksheet("Rincian Booking"),
    "REKAP BOOKING KENDARAAN DINAS",
    subtitle,
    [
      { header: "No", key: "no", width: 5 },
      { header: "No. Booking", key: "bookingNumber", width: 15 },
      { header: "Diajukan", key: "createdAt", width: 18 },
      { header: "Pemohon", key: "requester", width: 24 },
      { header: "NIP", key: "nip", width: 12 },
      { header: "Bagian", key: "department", width: 18 },
      { header: "Jabatan", key: "position", width: 18 },
      { header: "Mobil", key: "vehicle", width: 18 },
      { header: "Plat", key: "plate", width: 12 },
      { header: "Lokasi", key: "location", width: 16 },
      { header: "Mulai", key: "startAt", width: 18 },
      { header: "Selesai", key: "endAt", width: 18 },
      { header: "Durasi (jam)", key: "hours", width: 9, numFmt: "0.0" },
      { header: "Tujuan", key: "destination", width: 22 },
      { header: "Keperluan", key: "purpose", width: 30 },
      { header: "Penumpang", key: "passengers", width: 10 },
      { header: "Sopir", key: "driver", width: 20 },
      { header: "Status", key: "status", width: 14 },
      { header: "Diproses Oleh", key: "handledBy", width: 20 },
      { header: "Waktu Proses", key: "handledAt", width: 18 },
      { header: "Catatan / Alasan", key: "note", width: 28 },
      { header: "Berangkat", key: "departedAt", width: 18 },
      { header: "KM Awal", key: "startKm", width: 10, numFmt: "#,##0" },
      { header: "Kembali", key: "returnedAt", width: 18 },
      { header: "KM Akhir", key: "endKm", width: 10, numFmt: "#,##0" },
      { header: "Jarak (km)", key: "distance", width: 10, numFmt: "#,##0" },
      { header: "Kondisi Kembali", key: "returnNote", width: 28 },
    ],
    detailRows
  )

  // ── Sheet 2: per mobil
  type VehicleAgg = { vehicle: string; plate: string; location: string; total: number; done: number; cancelled: number; rejected: number; hours: number; distance: number }
  const byVehicle = new Map<number, VehicleAgg>()
  for (const b of bookings) {
    const agg = byVehicle.get(b.vehicle.id) ?? {
      vehicle: b.vehicle.name,
      plate: b.vehicle.plateNumber,
      location: b.vehicle.workLocation.name,
      total: 0,
      done: 0,
      cancelled: 0,
      rejected: 0,
      hours: 0,
      distance: 0,
    }
    agg.total++
    if (b.status === "SELESAI") {
      agg.done++
      agg.hours += hoursBetween(b.departedAt ?? b.startAt, b.returnedAt ?? b.endAt)
      agg.distance += distanceOf(b) ?? 0
    }
    if (b.status === "DIBATALKAN") agg.cancelled++
    if (b.status === "DITOLAK") agg.rejected++
    byVehicle.set(b.vehicle.id, agg)
  }
  const vehicleRows = [...byVehicle.values()]
    .sort((a, b) => a.location.localeCompare(b.location) || a.vehicle.localeCompare(b.vehicle))
    .map((v, i) => ({ no: i + 1, ...v, hours: Math.round(v.hours * 10) / 10 }))
  const sum = (rows: Record<string, unknown>[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)

  addTable(
    workbook.addWorksheet("Rekap per Mobil"),
    "REKAP PEMAKAIAN PER MOBIL",
    subtitle + " · jam & jarak dihitung dari booking berstatus Selesai",
    [
      { header: "No", key: "no", width: 5 },
      { header: "Mobil", key: "vehicle", width: 22 },
      { header: "Plat", key: "plate", width: 12 },
      { header: "Lokasi", key: "location", width: 18 },
      { header: "Total Booking", key: "total", width: 10 },
      { header: "Selesai", key: "done", width: 9 },
      { header: "Dibatalkan", key: "cancelled", width: 10 },
      { header: "Ditolak", key: "rejected", width: 9 },
      { header: "Jam Pakai", key: "hours", width: 10, numFmt: "0.0" },
      { header: "Jarak (km)", key: "distance", width: 11, numFmt: "#,##0" },
    ],
    vehicleRows,
    vehicleRows.length
      ? {
          vehicle: "TOTAL",
          total: sum(vehicleRows, "total"),
          done: sum(vehicleRows, "done"),
          cancelled: sum(vehicleRows, "cancelled"),
          rejected: sum(vehicleRows, "rejected"),
          hours: Math.round(sum(vehicleRows, "hours") * 10) / 10,
          distance: sum(vehicleRows, "distance"),
        }
      : undefined
  )

  // ── Sheet 3: per pemohon
  type RequesterAgg = { name: string; nip: string; department: string; total: number; done: number; cancelled: number; rejected: number; distance: number }
  const byRequester = new Map<number, RequesterAgg>()
  for (const b of bookings) {
    const agg = byRequester.get(b.requester.id) ?? {
      name: b.requester.fullName,
      nip: b.requester.employeeNumber,
      department: b.requester.department.name,
      total: 0,
      done: 0,
      cancelled: 0,
      rejected: 0,
      distance: 0,
    }
    agg.total++
    if (b.status === "SELESAI") {
      agg.done++
      agg.distance += distanceOf(b) ?? 0
    }
    if (b.status === "DIBATALKAN") agg.cancelled++
    if (b.status === "DITOLAK") agg.rejected++
    byRequester.set(b.requester.id, agg)
  }
  const requesterRows = [...byRequester.values()]
    .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name))
    .map((r, i) => ({ no: i + 1, ...r }))

  addTable(
    workbook.addWorksheet("Rekap per Pemohon"),
    "REKAP BOOKING PER PEMOHON",
    subtitle,
    [
      { header: "No", key: "no", width: 5 },
      { header: "Nama", key: "name", width: 26 },
      { header: "NIP", key: "nip", width: 12 },
      { header: "Bagian", key: "department", width: 20 },
      { header: "Total Booking", key: "total", width: 10 },
      { header: "Selesai", key: "done", width: 9 },
      { header: "Dibatalkan", key: "cancelled", width: 10 },
      { header: "Ditolak", key: "rejected", width: 9 },
      { header: "Jarak (km)", key: "distance", width: 11, numFmt: "#,##0" },
    ],
    requesterRows,
    requesterRows.length
      ? {
          name: "TOTAL",
          total: sum(requesterRows, "total"),
          done: sum(requesterRows, "done"),
          cancelled: sum(requesterRows, "cancelled"),
          rejected: sum(requesterRows, "rejected"),
          distance: sum(requesterRows, "distance"),
        }
      : undefined
  )

  return { workbook, count: bookings.length }
}
