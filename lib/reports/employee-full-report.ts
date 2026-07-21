import { readFile } from "fs/promises"
import path from "path"

import ExcelJS from "exceljs"

import type { EmployeeCvPayload } from "@/components/employee-cv-print"

const COMPANY_TITLE = "DATA PEGAWAI PERUMDA BPR BANK GRESIK"

const SECTION_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5D9F2" },
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
}

const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "Belum Menikah",
  MARRIED: "Menikah",
  DIVORCED: "Cerai",
  WIDOWED: "Janda/Duda",
}

const REWARD_PUNISHMENT_LABEL: Record<string, string> = {
  REWARD: "Reward",
  PUNISHMENT: "Punishment",
}

function formatDate(date: Date | null) {
  if (!date) return "-"
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
}

const IMAGE_EXTENSIONS: Record<string, ExcelJS.Image["extension"]> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".gif": "gif",
}

async function loadImageBuffer(
  url: string | null
): Promise<{ buffer: Buffer; extension: ExcelJS.Image["extension"] } | null> {
  if (!url) return null
  const extension = IMAGE_EXTENSIONS[path.extname(url).toLowerCase()]
  if (!extension) return null

  try {
    if (url.startsWith("/")) {
      const buffer = await readFile(path.join(process.cwd(), "public", url))
      return { buffer, extension }
    }
    if (url.startsWith("http")) {
      const response = await fetch(url)
      if (!response.ok) return null
      const buffer = Buffer.from(await response.arrayBuffer())
      return { buffer, extension }
    }
  } catch {
    return null
  }
  return null
}

// Dipakai berulang buat blok "Foto Pegawai", TTD, Paraf, Sidik Jari — kalau
// filenya tidak ada/gagal dibaca, ditulis teks "Kosong" (bukan gambar
// placeholder) sesuai permintaan, supaya tidak perlu menggambar kotak "NO IMAGE".
async function placeImageOrKosong(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  url: string | null,
  anchorRow: number,
  anchorCol: number,
  widthPx: number,
  heightPx: number
) {
  const image = await loadImageBuffer(url)
  if (!image) {
    sheet.getCell(anchorRow, anchorCol).value = "Kosong"
    return
  }
  // exceljs's bundled types resolve `Buffer` against a different @types/node
  // instance than this project's, so the two `Buffer` types don't structurally
  // match even though they're identical at runtime — cast past the mismatch.
  const imageId = workbook.addImage({
    buffer: image.buffer,
    extension: image.extension,
  } as unknown as ExcelJS.Image)
  sheet.addImage(imageId, {
    tl: { col: anchorCol - 1, row: anchorRow - 1 },
    ext: { width: widthPx, height: heightPx },
  })
}

function sectionHeader(sheet: ExcelJS.Worksheet, row: number, title: string, span: number) {
  sheet.mergeCells(row, 1, row, span)
  const cell = sheet.getCell(row, 1)
  cell.value = title
  cell.font = { bold: true }
  cell.fill = SECTION_FILL
}

function identityRow(sheet: ExcelJS.Worksheet, row: number, label: string, value: string) {
  sheet.getCell(row, 1).value = label
  sheet.getCell(row, 1).font = { bold: true }
  sheet.getCell(row, 2).value = ":"
  sheet.getCell(row, 3).value = value
}

function tableSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  head: string[],
  rows: string[][],
  span: number
): number {
  sectionHeader(sheet, startRow, title, span)
  const headerRow = startRow + 1
  head.forEach((label, index) => {
    const cell = sheet.getCell(headerRow, 1 + index)
    cell.value = label
    cell.font = { bold: true }
    cell.fill = SECTION_FILL
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    }
  })
  if (head.length < span) {
    sheet.mergeCells(headerRow, head.length, headerRow, span)
  }

  if (rows.length === 0) {
    return headerRow + 1
  }
  rows.forEach((rowValues, rowIndex) => {
    const rowNumber = headerRow + 1 + rowIndex
    rowValues.forEach((value, colIndex) => {
      const cell = sheet.getCell(rowNumber, 1 + colIndex)
      cell.value = value || "-"
      cell.alignment = { vertical: "top", wrapText: true }
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      }
    })
  })
  return headerRow + 1 + rows.length
}

const INVALID_SHEET_NAME_CHARS = /[\\/?*[\]:]/g

function uniqueSheetName(usedNames: Set<string>, fullName: string, employeeNumber: string) {
  const base = fullName.replace(INVALID_SHEET_NAME_CHARS, " ").trim().slice(0, 31) || "Pegawai"
  if (!usedNames.has(base)) {
    usedNames.add(base)
    return base
  }
  const withNumber = `${base.slice(0, 31 - employeeNumber.length - 1)} ${employeeNumber}`
  usedNames.add(withNumber)
  return withNumber
}

async function buildEmployeeSheet(
  workbook: ExcelJS.Workbook,
  employee: EmployeeCvPayload,
  sheetName: string
) {
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = [
    { width: 22 },
    { width: 3 },
    { width: 32 },
    { width: 18 },
    { width: 18 },
  ]

  sheet.mergeCells(1, 1, 1, 5)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = COMPANY_TITLE
  titleCell.font = { bold: true, size: 12 }

  sectionHeader(sheet, 3, "IDENTITAS PEGAWAI", 3)
  sheet.mergeCells(3, 5, 3, 5)
  sheet.getCell(3, 5).value = "FOTO PEGAWAI"
  sheet.getCell(3, 5).font = { bold: true }

  const identityRows: [string, string][] = [
    ["Nama Lengkap", employee.fullName],
    ["NIPD", employee.employeeNumber],
    ["Tempat/Tanggal Lahir", `${employee.birthPlace}, ${formatDate(employee.birthDate)}`],
    ["Jenis Kelamin", GENDER_LABEL[employee.gender] ?? employee.gender],
    ["Alamat", employee.address],
    ["Alamat Tempat Tinggal", employee.ktpAddress || employee.address],
    ["Pendidikan Formal", employee.lastEducation || "-"],
    ["Nomer Handphone", employee.phone],
    ["Status", employee.maritalStatus ? MARITAL_LABEL[employee.maritalStatus] : "-"],
  ]
  identityRows.forEach(([label, value], index) => {
    identityRow(sheet, 4 + index, label, value)
  })

  await placeImageOrKosong(workbook, sheet, employee.photoUrl, 4, 5, 110, 130)

  let row = 4 + identityRows.length + 1
  sectionHeader(sheet, row, "KELUARGA PEGAWAI", 3)
  row += 1

  const familyRows: [string, string][] = [
    ["Nama Suami/Istri", employee.spouse?.fullName || "-"],
    [
      "Tempat/Tanggal Lahir",
      employee.spouse
        ? `${employee.spouse.birthPlace || "-"}${employee.spouse.birthDate ? `, ${formatDate(employee.spouse.birthDate)}` : ""}`
        : "-",
    ],
    ["Pekerjaan Suami/Istri", employee.spouse?.occupation || "-"],
    ["Tunjangan Suami/Istri", "-"],
  ]
  employee.children.forEach((child, index) => {
    familyRows.push([`Anak Ke ${index + 1}`, child.fullName])
    familyRows.push([
      "Tempat/Tanggal Lahir",
      `${child.birthPlace || "-"}${child.birthDate ? `, ${formatDate(child.birthDate)}` : ""}`,
    ])
  })
  familyRows.push(["Tanggal Mulai Kerja", formatDate(employee.startDate)])
  familyRows.push(["Jabatan", employee.position.name])
  familyRows.push(["Surat Keluar", employee.exitLetterNumber || "-"])

  familyRows.forEach(([label, value], index) => {
    identityRow(sheet, row + index, label, value)
  })
  row += familyRows.length + 1

  row = tableSection(
    sheet,
    row,
    "RIWAYAT PEKERJAAN",
    ["TANGGAL", "URAIAN"],
    employee.workHistories.map((h) => [formatDate(h.date), h.description]),
    5
  )
  row += 1

  row = tableSection(
    sheet,
    row,
    "PENDIDIKAN & PELATIHAN",
    ["TANGGAL", "URAIAN", "LINK FILE"],
    employee.trainings.map((t) => [formatDate(t.date), t.description, t.fileUrl || "-"]),
    5
  )
  row += 1

  row = tableSection(
    sheet,
    row,
    "PRESTASI PEGAWAI",
    ["TANGGAL", "URAIAN", "LINK FILE"],
    employee.achievements.map((a) => [formatDate(a.date), a.description, a.fileUrl || "-"]),
    5
  )
  row += 1

  row = tableSection(
    sheet,
    row,
    "REWARD AND PUNISHMENT",
    ["TANGGAL", "URAIAN"],
    employee.rewardsPunishments.map((r) => [
      formatDate(r.date),
      `(${REWARD_PUNISHMENT_LABEL[r.type]}) ${r.description}`,
    ]),
    5
  )
  row += 1

  row = tableSection(
    sheet,
    row,
    "MUTASI PEGAWAI",
    ["TANGGAL", "JABATAN LAMA -> JABATAN BARU", "URAIAN", "LINK FILE"],
    employee.mutations.map((m) => [
      formatDate(m.date),
      `${m.oldPosition || "-"} -> ${m.newPosition || "-"}`,
      m.description || "-",
      m.fileUrl || "-",
    ]),
    5
  )
  row += 1

  row = tableSection(
    sheet,
    row,
    "DATA SURAT TUGAS PEGAWAI",
    ["TANGGAL", "URAIAN", "FILE LINK"],
    employee.assignmentLetters.map((s) => [formatDate(s.date), s.description, s.fileUrl || "-"]),
    5
  )
  row += 1

  sectionHeader(sheet, row, "DATA TAMBAHAN PEGAWAI", 5)
  row += 1
  sheet.getCell(row, 1).value = "JENIS DATA"
  sheet.getCell(row, 1).font = { bold: true }
  sheet.mergeCells(row, 2, row, 5)
  sheet.getCell(row, 2).value = "FILE"
  sheet.getCell(row, 2).font = { bold: true }
  row += 1

  const extraImages: [string, string | null][] = [
    ["TTD", employee.signatureUrl],
    ["Paraf", employee.initialsUrl],
    ["Sidik Jari Kanan", employee.fingerprintRightUrl],
    ["Sidik Jari Kiri", employee.fingerprintLeftUrl],
  ]
  for (const [label, url] of extraImages) {
    sheet.getCell(row, 1).value = label
    sheet.getRow(row).height = 70
    await placeImageOrKosong(workbook, sheet, url, row, 2, 130, 65)
    row += 1
  }
}

export async function buildEmployeeFullReportWorkbook(
  employees: EmployeeCvPayload[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()

  const usedNames = new Set<string>()
  for (const employee of employees) {
    const sheetName = uniqueSheetName(usedNames, employee.fullName, employee.employeeNumber)
    await buildEmployeeSheet(workbook, employee, sheetName)
  }

  return workbook
}
