import ExcelJS from "exceljs"
import type { Prisma } from "@prisma/client"

const COMPANY_NAME = "PERUMDA BANK GRESIK"

export type EmployeeReportRecord = Prisma.EmployeeGetPayload<{
  include: {
    department: true
    position: true
    workLocation: true
    employmentStatus: true
  }
}>

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "L",
  FEMALE: "P",
}

// Pendidikan disimpan bebas teks (bukan enum), jadi dikelompokkan lewat
// pencocokan kata kunci — SMA dan SMK digabung jadi satu baris "SMA/K"
// sesuai format rekap yang dipakai perusahaan.
type EducationBucket = "S1" | "S2" | "S3" | "D3" | "SMA/K" | "SMP" | "LAINNYA"

function categorizeEducation(raw: string | null): EducationBucket {
  const value = (raw ?? "").trim().toUpperCase()
  if (value === "S1") return "S1"
  if (value === "S2") return "S2"
  if (value === "S3") return "S3"
  if (value === "D3") return "D3"
  if (value === "SMA" || value === "SMK") return "SMA/K"
  if (value === "SMP") return "SMP"
  return "LAINNYA"
}

// Satu-satunya status yang dianggap "Tetap" adalah nama status persis
// "tetap" (case-insensitive) — sisanya (Kontrak, Percobaan, Magang, dll)
// dianggap kelompok "Kontrak" di rekap, konsisten dengan
// lib/employee-utils.ts yang sudah membedakan status kontrak vs tetap.
function isPermanentStatus(statusName: string) {
  return statusName.trim().toLowerCase() === "tetap"
}

const SHEET1_HEADERS = [
  "No",
  "NIP",
  "NAMA PEGAWAI",
  "MULAI KERJA",
  "BAGIAN",
  "JABATAN",
  "LOKASI KERJA",
  "PENDIDIKAN TERAKHIR",
  "JURUSAN",
  "GELAR",
  "TEMPAT/TANGGAL LAHIR",
  "PANGKAT",
  "JENIS KELAMIN",
  "STATUS",
  "NIK",
  "ALAMAT DOMISILI",
  "NO HANDPHONE",
]

function buildDataSheet(workbook: ExcelJS.Workbook, employees: EmployeeReportRecord[]) {
  const sheet = workbook.addWorksheet("Data Pegawai")
  const lastCol = SHEET1_HEADERS.length

  sheet.mergeCells(1, 1, 1, lastCol)
  sheet.getCell(1, 1).value = "DATA PENGURUS DAN PEGAWAI"
  sheet.mergeCells(2, 1, 2, lastCol)
  sheet.getCell(2, 1).value = COMPANY_NAME
  for (const row of [1, 2]) {
    const cell = sheet.getCell(row, 1)
    cell.font = { bold: true, size: 12 }
    cell.alignment = { horizontal: "center" }
  }

  const headerRow = sheet.getRow(3)
  SHEET1_HEADERS.forEach((label, index) => {
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
  headerRow.height = 30

  employees.forEach((employee, index) => {
    const row = sheet.getRow(4 + index)
    const values = [
      index + 1,
      employee.employeeNumber,
      employee.fullName,
      formatDate(employee.startDate),
      employee.department.name,
      employee.position.name,
      employee.workLocation.name,
      employee.lastEducation ?? "-",
      employee.major ?? "-",
      employee.degree ?? "-",
      `${employee.birthPlace}/${formatDate(employee.birthDate)}`,
      employee.rank ?? "-",
      GENDER_LABEL[employee.gender] ?? employee.gender,
      `Pegawai ${employee.employmentStatus.name}`,
      employee.nik,
      employee.address,
      employee.phone,
    ]
    values.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1)
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
    { width: 14 },
    { width: 26 },
    { width: 13 },
    { width: 20 },
    { width: 22 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 10 },
    { width: 22 },
    { width: 10 },
    { width: 10 },
    { width: 16 },
    { width: 18 },
    { width: 28 },
    { width: 16 },
  ]
  sheet.views = [{ state: "frozen", ySplit: 3 }]
}

type CountRow = [string, number]

// Menulis satu tabel kecil (judul + baris label/angka, baris terakhir bold
// sebagai Total) mulai dari kolom/baris tertentu — dipakai berulang buat
// semua blok rekap (Jenis Kelamin, Pendidikan x3, Bagian, Status Pekerjaan).
function writeCountTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  title: string,
  rows: CountRow[]
) {
  sheet.mergeCells(startRow, startCol, startRow, startCol + 1)
  const titleCell = sheet.getCell(startRow, startCol)
  titleCell.value = title
  titleCell.font = { bold: true }
  titleCell.alignment = { horizontal: "center" }
  titleCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  }
  sheet.getCell(startRow, startCol + 1).border = titleCell.border

  rows.forEach(([label, count], index) => {
    const rowIndex = startRow + 1 + index
    const isTotal = label.toUpperCase() === "TOTAL"
    const labelCell = sheet.getCell(rowIndex, startCol)
    const countCell = sheet.getCell(rowIndex, startCol + 1)
    labelCell.value = label
    countCell.value = count
    if (isTotal) {
      labelCell.font = { bold: true }
      countCell.font = { bold: true }
    }
    countCell.alignment = { horizontal: "center" }
    for (const cell of [labelCell, countCell]) {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      }
    }
  })

  return startRow + 1 + rows.length // baris berikutnya yang masih kosong
}

function educationRows(employees: EmployeeReportRecord[]): CountRow[] {
  const buckets: Record<EducationBucket, number> = {
    S1: 0,
    S2: 0,
    S3: 0,
    D3: 0,
    "SMA/K": 0,
    SMP: 0,
    LAINNYA: 0,
  }
  for (const employee of employees) {
    buckets[categorizeEducation(employee.lastEducation)] += 1
  }
  const rows: CountRow[] = [
    ["S1", buckets.S1],
    ["S2", buckets.S2],
    ["S3", buckets.S3],
    ["D3", buckets.D3],
    ["SMA/K", buckets["SMA/K"]],
    ["SMP", buckets.SMP],
  ]
  if (buckets.LAINNYA > 0) {
    rows.push(["Lainnya", buckets.LAINNYA])
  }
  rows.push(["TOTAL", employees.length])
  return rows
}

function buildRecapSheet(workbook: ExcelJS.Workbook, employees: EmployeeReportRecord[]) {
  const sheet = workbook.addWorksheet("Rekap Pegawai")
  const year = new Date().getFullYear()

  sheet.mergeCells(1, 1, 1, 4)
  sheet.getCell(1, 1).value = "REKAP PEGAWAI"
  sheet.mergeCells(2, 1, 2, 4)
  sheet.getCell(2, 1).value = `REKAP ${COMPANY_NAME}`
  sheet.mergeCells(3, 1, 3, 4)
  sheet.getCell(3, 1).value = `TAHUN ${year}`
  for (const row of [1, 2, 3]) {
    const cell = sheet.getCell(row, 1)
    cell.font = { bold: true, size: row === 1 ? 13 : 11 }
    cell.alignment = { horizontal: "center" }
  }

  const permanentEmployees = employees.filter((e) => isPermanentStatus(e.employmentStatus.name))
  const contractEmployees = employees.filter((e) => !isPermanentStatus(e.employmentStatus.name))

  const femaleCount = employees.filter((e) => e.gender === "FEMALE").length
  const maleCount = employees.filter((e) => e.gender === "MALE").length

  const blockStartRow = 5
  writeCountTable(sheet, blockStartRow, 1, "JENIS KELAMIN", [
    ["PEREMPUAN", femaleCount],
    ["LAKI-LAKI", maleCount],
    ["TOTAL", employees.length],
  ])
  writeCountTable(sheet, blockStartRow, 4, "PENDIDIKAN", educationRows(employees))
  writeCountTable(
    sheet,
    blockStartRow,
    7,
    "PENDIDIKAN (PEGAWAI TETAP)",
    educationRows(permanentEmployees)
  )
  writeCountTable(
    sheet,
    blockStartRow,
    10,
    "PENDIDIKAN (PEGAWAI KONTRAK)",
    educationRows(contractEmployees)
  )

  const departmentCounts = new Map<string, number>()
  for (const employee of employees) {
    const name = employee.department.name
    departmentCounts.set(name, (departmentCounts.get(name) ?? 0) + 1)
  }
  const departmentRows: CountRow[] = [
    ...Array.from(departmentCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    ["TOTAL", employees.length],
  ]

  const secondBlockRow = 16
  writeCountTable(sheet, secondBlockRow, 1, "BAGIAN", departmentRows)

  writeCountTable(sheet, secondBlockRow, 4, "STATUS PEKERJAAN", [
    ["TETAP", permanentEmployees.length],
    ["KONTRAK", contractEmployees.length],
    ["TOTAL", employees.length],
  ])

  sheet.columns = [
    { width: 22 },
    { width: 10 },
    { width: 3 },
    { width: 22 },
    { width: 10 },
    { width: 3 },
    { width: 22 },
    { width: 10 },
    { width: 3 },
    { width: 22 },
    { width: 10 },
  ]
}

export async function buildEmployeeReportWorkbook(
  employees: EmployeeReportRecord[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()

  buildDataSheet(workbook, employees)
  buildRecapSheet(workbook, employees)

  return workbook
}
