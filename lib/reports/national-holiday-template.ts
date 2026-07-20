import ExcelJS from "exceljs"

const HEADERS = ["Tanggal (DD-MM-YYYY)", "Nama Hari Libur", "Kantor Tetap Masuk (Ya/Tidak)"]

const EXAMPLE_ROWS: [string, string, string][] = [
  ["01-01-2026", "Tahun Baru Masehi", "Tidak"],
  ["17-08-2026", "Hari Kemerdekaan RI", "Tidak"],
  ["25-12-2026", "Hari Raya Natal", "Tidak"],
]

export async function buildNationalHolidayTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HRM"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Hari Libur Nasional")

  const headerRow = sheet.getRow(1)
  HEADERS.forEach((label, index) => {
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
  headerRow.height = 24

  EXAMPLE_ROWS.forEach((values, rowIndex) => {
    const row = sheet.getRow(2 + rowIndex)
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

  sheet.columns = [{ width: 20 }, { width: 32 }, { width: 26 }]

  return workbook
}
