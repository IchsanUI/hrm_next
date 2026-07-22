import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"

// Urutan kolom di sini HARUS sinkron dengan urutan parsing di
// importEmployeesAction (server/actions/employees.ts) — index kolom dipakai
// langsung lewat row.getCell(n), bukan dicari berdasarkan header text.
const HEADERS = [
  "NIP*",
  "Nama Lengkap*",
  "Tanggal Mulai Kerja* (DD-MM-YYYY)",
  "Bagian*",
  "Jabatan*",
  "Lokasi Kerja*",
  "Status Kepegawaian*",
  "Tanggal Lahir* (DD-MM-YYYY)",
  "Tempat Lahir*",
  "Jenis Kelamin* (L/P)",
  "NIK*",
  "Alamat*",
  "No. HP*",
  "Email*",
  "PIN Mesin Absensi",
  "Nama Shift",
  "Pendidikan Terakhir",
  "Jurusan",
  "Gelar",
  "Status Pernikahan (Menikah/Belum Menikah/Cerai Hidup/Cerai Mati)",
]

const EXAMPLE_ROW = [
  "24001",
  "Budi Santoso",
  "01-01-2026",
  "Produksi",
  "Operator",
  "Kantor Pusat",
  "Tetap",
  "17-08-1998",
  "Gresik",
  "L",
  "3525xxxxxxxxxxxx",
  "Jl. Contoh No. 1, Gresik",
  "081234567890",
  "budi.santoso@example.com",
  "144",
  "Shift Pagi",
  "SMA",
  "",
  "",
  "Belum Menikah",
]

const COLUMN_WIDTHS = [
  14, 24, 20, 18, 18, 18, 18, 20, 16, 14, 20, 28, 16, 26, 16, 16, 16, 16, 12, 30,
]

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

// Sheet kedua isinya daftar nama Bagian/Jabatan/Lokasi Kerja/Status
// Kepegawaian/Shift yang SUDAH ADA di sistem — dipakai sebagai acuan supaya
// admin mengetik nama yang persis sama (pencocokan saat import berdasarkan
// nama, case-insensitive, bukan ID).
async function buildReferenceSheet(workbook: ExcelJS.Workbook) {
  const [departments, positions, workLocations, employmentStatuses, workShifts] =
    await Promise.all([
      prisma.department.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: "asc" } }),
      prisma.position.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.workLocation.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.employmentStatus.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.workShift.findMany({ select: { name: true, type: true }, orderBy: { name: "asc" } }),
    ])

  const sheet = workbook.addWorksheet("Referensi")
  const groups: [string, string[]][] = [
    ["Bagian", departments.map((d) => d.name)],
    ["Jabatan", positions.map((p) => p.name)],
    ["Lokasi Kerja", workLocations.map((w) => w.name)],
    ["Status Kepegawaian", employmentStatuses.map((s) => s.name)],
    ["Nama Shift", workShifts.map((s) => `${s.name} (${s.type === "PEGAWAI" ? "Pegawai" : "Outsourcing"})`)],
  ]

  let col = 1
  for (const [title, values] of groups) {
    const headerCell = sheet.getRow(1).getCell(col)
    headerCell.value = title
    styleHeaderCell(headerCell)
    values.forEach((value, i) => {
      sheet.getRow(2 + i).getCell(col).value = value
    })
    sheet.getColumn(col).width = 26
    col += 1
  }
}

export async function buildEmployeeImportTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Data Pegawai")

  const headerRow = sheet.getRow(1)
  HEADERS.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    styleHeaderCell(cell)
  })
  headerRow.height = 32

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
