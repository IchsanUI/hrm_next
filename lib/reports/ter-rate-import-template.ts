import ExcelJS from "exceljs"

// Urutan kolom di sini HARUS sinkron dengan urutan parsing di
// importTerRatesAction (server/actions/payroll-tax.ts) — index kolom
// dipakai langsung lewat row.getCell(n), bukan dicari berdasarkan header.
const HEADERS = ["Kategori* (A/B/C)", "Urutan", "Bruto Dari* (Rp/bulan)", "Bruto Sampai (Rp/bulan)", "Tarif TER* (%)"]

// Contoh ILUSTRASI saja (bukan nominal resmi) — admin WAJIB mengisi ulang
// sesuai lampiran PMK 168/2023 yang berlaku, lihat catatan di sheet
// Referensi.
const EXAMPLE_ROWS = [
  ["A", "0", "0", "5400000", "0"],
  ["A", "1", "5400000", "5650000", "0.25"],
  ["A", "2", "5650000", "5950000", "0.5"],
]

const COLUMN_WIDTHS = [16, 10, 20, 20, 16]

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

function buildReferenceSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Referensi")
  const lines = [
    "Kategori TER ditentukan OTOMATIS dari status PTKP pegawai (bukan dipilih manual saat import pegawai):",
    "Kategori A: TK/0, TK/1, K/0",
    "Kategori B: TK/2, TK/3, K/1, K/2",
    "Kategori C: K/3",
    "",
    "Baris \"Bruto Dari\" & \"Bruto Sampai\" adalah lapisan penghasilan BRUTO BULANAN (bukan tahunan seperti tarif progresif Pasal 17).",
    "\"Bruto Sampai\" boleh dikosongkan untuk lapisan tertinggi (tidak terbatas).",
    "",
    "PENTING: nominal contoh di sheet \"Tarif TER\" HANYA ILUSTRASI FORMAT, BUKAN tarif resmi.",
    "Isi ulang sesuai Lampiran PMK 168/2023 (atau revisi terbaru yang berlaku) sebelum diimport.",
    "",
    "Import ulang file untuk kategori yang sama akan MENIMPA seluruh tarif kategori tersebut (bukan menambah/duplikat) — aman dipakai untuk revisi.",
  ]
  lines.forEach((line, i) => {
    sheet.getRow(i + 1).getCell(1).value = line
  })
  sheet.getColumn(1).width = 100
}

export async function buildTerRateImportTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRIS"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Tarif TER")

  const headerRow = sheet.getRow(1)
  HEADERS.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    styleHeaderCell(cell)
  })
  headerRow.height = 28

  EXAMPLE_ROWS.forEach((values, rowIndex) => {
    const row = sheet.getRow(2 + rowIndex)
    values.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      cell.value = value
      styleDataCell(cell)
    })
  })

  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }))

  buildReferenceSheet(workbook)

  return workbook
}
