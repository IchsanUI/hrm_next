import ExcelJS from "exceljs"

import { prisma } from "@/lib/prisma"
import { signWorkbook } from "@/lib/app-signature"

// Import massal data riwayat pegawai (tab Riwayat di Detail Pegawai) dari
// satu file Excel untuk SEMUA pegawai — TANPA file pendukung (file tetap
// diunggah satu per satu dari halaman detail). Definisi sheet & kolom di
// sini dipakai bersama oleh template (GET /api/master-data/pegawai/riwayat-template)
// dan parser import, supaya urutan kolomnya tidak bisa tidak sinkron.

export type HistoryKind = "workHistory" | "training" | "achievement" | "rewardPunishment" | "mutation" | "assignmentLetter"

type Column = { header: string; width: number; example: string }

export const HISTORY_SHEETS: { kind: HistoryKind; sheet: string; label: string; columns: Column[]; note?: string }[] = [
  {
    kind: "workHistory",
    sheet: "Riwayat Pekerjaan",
    label: "Riwayat Pekerjaan",
    columns: [
      { header: "NIP*", width: 14, example: "24001" },
      { header: "Tanggal* (DD-MM-YYYY)", width: 20, example: "01-03-2020" },
      { header: "Uraian*", width: 60, example: "Staf Administrasi di PT Contoh Jaya" },
    ],
  },
  {
    kind: "training",
    sheet: "Pendidikan & Pelatihan",
    label: "Pendidikan & Pelatihan",
    columns: [
      { header: "NIP*", width: 14, example: "24001" },
      { header: "Tanggal* (DD-MM-YYYY)", width: 20, example: "15-07-2024" },
      { header: "Uraian*", width: 60, example: "Pelatihan K3 Umum" },
    ],
  },
  {
    kind: "achievement",
    sheet: "Prestasi",
    label: "Prestasi",
    columns: [
      { header: "NIP*", width: 14, example: "24001" },
      { header: "Tanggal* (DD-MM-YYYY)", width: 20, example: "20-12-2024" },
      { header: "Uraian*", width: 60, example: "Karyawan Teladan 2024" },
    ],
  },
  {
    kind: "rewardPunishment",
    sheet: "Reward & Punishment",
    label: "Reward & Punishment",
    columns: [
      { header: "NIP*", width: 14, example: "24001" },
      { header: "Tanggal* (DD-MM-YYYY)", width: 20, example: "05-01-2025" },
      { header: "Jenis* (Reward/Punishment)", width: 22, example: "Reward" },
      { header: "Uraian*", width: 60, example: "Bonus pencapaian target" },
    ],
  },
  {
    kind: "mutation",
    sheet: "Mutasi",
    label: "Mutasi",
    columns: [
      { header: "NIP*", width: 14, example: "24001" },
      { header: "Tanggal* (DD-MM-YYYY)", width: 20, example: "01-02-2025" },
      { header: "Jabatan Lama", width: 24, example: "Staf" },
      { header: "Jabatan Baru", width: 24, example: "Kepala Seksi" },
      { header: "Uraian", width: 50, example: "Promosi jabatan" },
    ],
    note: "Selain Tanggal, minimal satu dari Jabatan Lama / Jabatan Baru / Uraian wajib diisi.",
  },
  {
    kind: "assignmentLetter",
    sheet: "Surat Tugas",
    label: "Surat Tugas",
    columns: [
      { header: "NIP*", width: 14, example: "24001" },
      { header: "Tanggal* (DD-MM-YYYY)", width: 20, example: "10-04-2025" },
      { header: "Uraian*", width: 60, example: "Tugas audit cabang Surabaya" },
    ],
  },
]

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
}

export async function buildHistoryImportTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook()
  signWorkbook(workbook)

  const guide = workbook.addWorksheet("Petunjuk")
  guide.getColumn(1).width = 110
  const lines = [
    "PETUNJUK IMPORT DATA RIWAYAT PEGAWAI",
    "",
    "1. Satu file ini untuk SEMUA pegawai. Setiap jenis riwayat punya sheet sendiri — isi yang perlu saja, sheet kosong dilewati.",
    "2. Kolom NIP harus sama persis dengan NIP pegawai di sistem (lihat sheet \"Daftar Pegawai\").",
    "3. Tanggal ditulis DD-MM-YYYY (mis. 01-03-2020) atau memakai format tanggal Excel.",
    "4. Baris contoh (baris ke-2 tiap sheet) boleh dihapus atau ditimpa.",
    "5. File pendukung (sertifikat, SK, surat tugas) TIDAK diimpor — unggah satu per satu dari halaman Detail Pegawai → tab Riwayat.",
    "6. Baris yang sama persis dengan data yang sudah ada (pegawai, tanggal, dan isi sama) otomatis dilewati, jadi file aman diimpor ulang.",
  ]
  lines.forEach((text, i) => {
    const cell = guide.getCell(i + 1, 1)
    cell.value = text
    cell.alignment = { wrapText: true, vertical: "top" }
    if (i === 0) cell.font = { bold: true, size: 13 }
  })

  for (const def of HISTORY_SHEETS) {
    const ws = workbook.addWorksheet(def.sheet)
    def.columns.forEach((col, i) => {
      ws.getColumn(i + 1).width = col.width
      const header = ws.getCell(1, i + 1)
      header.value = col.header
      header.font = { bold: true }
      header.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
      header.border = BORDER
      header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF0" } }
      const example = ws.getCell(2, i + 1)
      example.value = col.example
      example.font = { italic: true, color: { argb: "FF888888" } }
      example.border = BORDER
    })
    // Kolom NIP & tanggal sebagai teks supaya NIP berawalan 0 tidak hilang.
    ws.getColumn(1).numFmt = "@"
    ws.views = [{ state: "frozen", ySplit: 1 }]
    if (def.note) {
      const noteCell = ws.getCell(1, def.columns.length + 2)
      noteCell.value = def.note
      noteCell.font = { italic: true, color: { argb: "FF666666" } }
      ws.getColumn(def.columns.length + 2).width = 60
    }
  }

  const ref = workbook.addWorksheet("Daftar Pegawai")
  ref.columns = [
    { header: "NIP", key: "nip", width: 16 },
    { header: "Nama", key: "name", width: 32 },
    { header: "Bagian", key: "dept", width: 26 },
    { header: "Jabatan", key: "pos", width: 26 },
  ]
  ref.getRow(1).font = { bold: true }
  const employees = await prisma.employee.findMany({
    where: { isDeleted: false },
    select: { employeeNumber: true, fullName: true, department: { select: { name: true } }, position: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  })
  for (const e of employees) {
    ref.addRow({ nip: e.employeeNumber, name: e.fullName, dept: e.department.name, pos: e.position.name })
  }
  ref.getColumn(1).numFmt = "@"

  return workbook
}

// ---------- Parsing ----------

export function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (raw instanceof Date) return ""
  if (typeof raw === "object") {
    if ("text" in raw) return String((raw as { text: unknown }).text ?? "").trim()
    if ("richText" in raw) {
      return ((raw as { richText: { text: string }[] }).richText ?? []).map((r) => r.text).join("").trim()
    }
    if ("result" in raw) return String((raw as { result: unknown }).result ?? "").trim()
  }
  return String(raw).trim()
}

// Date asli dari Excel ATAU teks "DD-MM-YYYY" / "DD/MM/YYYY" / "YYYY-MM-DD" → "YYYY-MM-DD".
export function parseCellDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // exceljs mengembalikan tanggal Excel sebagai Date UTC tengah malam.
    return raw.toISOString().slice(0, 10)
  }
  const value = cellText(raw)
  const dmy = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  let iso: string | null = null
  if (dmy) iso = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  const ymd = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) iso = `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00Z`)
  // Tolak tanggal tidak nyata (mis. 31-02-2024) & tahun yang jelas salah ketik.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null
  const year = date.getUTCFullYear()
  if (year < 1950 || year > new Date().getFullYear() + 1) return null
  return iso
}

export function parseRewardType(raw: unknown): "REWARD" | "PUNISHMENT" | null {
  const v = cellText(raw).toLowerCase()
  if (v === "reward" || v === "penghargaan") return "REWARD"
  if (v === "punishment" || v === "sanksi" || v === "hukuman") return "PUNISHMENT"
  return null
}

// ---------- Import ----------

const MAX_ROWS = 5000

export type HistoryImportSummary = {
  kind: HistoryKind
  label: string
  inserted: number
  duplicates: number
  invalid: number
}

export type HistoryImportResult = {
  summaries: HistoryImportSummary[]
  errors: string[] // "Sheet X, baris N: alasan" — maks. 50 pertama
  totalErrors: number
}

type ParsedRow = {
  employeeId: number
  date: string
  type?: "REWARD" | "PUNISHMENT"
  oldPosition?: string | null
  newPosition?: string | null
  description: string | null
}

function norm(v: string | null | undefined) {
  return (v ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

function dedupeKey(kind: HistoryKind, r: ParsedRow) {
  return [kind, r.employeeId, r.date, r.type ?? "", norm(r.oldPosition), norm(r.newPosition), norm(r.description)].join("|")
}

function isoOf(d: Date) {
  return d.toISOString().slice(0, 10)
}

type HistoryDelegates = Pick<
  typeof prisma,
  | "employeeWorkHistory"
  | "employeeTraining"
  | "employeeAchievement"
  | "employeeRewardPunishment"
  | "employeeMutation"
  | "employeeAssignmentLetter"
>

async function existingKeys(db: HistoryDelegates, kind: HistoryKind, employeeIds: number[]): Promise<Set<string>> {
  const where = { employeeId: { in: employeeIds } }
  const rows: ParsedRow[] = []
  switch (kind) {
    case "workHistory":
      for (const r of await db.employeeWorkHistory.findMany({ where })) rows.push({ ...r, date: isoOf(r.date) })
      break
    case "training":
      for (const r of await db.employeeTraining.findMany({ where })) rows.push({ ...r, date: isoOf(r.date) })
      break
    case "achievement":
      for (const r of await db.employeeAchievement.findMany({ where })) rows.push({ ...r, date: isoOf(r.date) })
      break
    case "rewardPunishment":
      for (const r of await db.employeeRewardPunishment.findMany({ where })) rows.push({ ...r, date: isoOf(r.date) })
      break
    case "mutation":
      for (const r of await db.employeeMutation.findMany({ where })) rows.push({ ...r, date: isoOf(r.date) })
      break
    case "assignmentLetter":
      for (const r of await db.employeeAssignmentLetter.findMany({ where })) rows.push({ ...r, date: isoOf(r.date) })
      break
  }
  return new Set(rows.map((r) => dedupeKey(kind, r)))
}

async function insertRows(db: HistoryDelegates, kind: HistoryKind, rows: ParsedRow[]) {
  const date = (r: ParsedRow) => new Date(`${r.date}T00:00:00Z`)
  switch (kind) {
    case "workHistory":
      return db.employeeWorkHistory.createMany({
        data: rows.map((r) => ({ employeeId: r.employeeId, date: date(r), description: r.description ?? "" })),
      })
    case "training":
      return db.employeeTraining.createMany({
        data: rows.map((r) => ({ employeeId: r.employeeId, date: date(r), description: r.description ?? "" })),
      })
    case "achievement":
      return db.employeeAchievement.createMany({
        data: rows.map((r) => ({ employeeId: r.employeeId, date: date(r), description: r.description ?? "" })),
      })
    case "rewardPunishment":
      return db.employeeRewardPunishment.createMany({
        data: rows.map((r) => ({
          employeeId: r.employeeId,
          date: date(r),
          type: r.type ?? "REWARD",
          description: r.description ?? "",
        })),
      })
    case "mutation":
      return db.employeeMutation.createMany({
        data: rows.map((r) => ({
          employeeId: r.employeeId,
          date: date(r),
          oldPosition: r.oldPosition ?? null,
          newPosition: r.newPosition ?? null,
          description: r.description,
        })),
      })
    case "assignmentLetter":
      return db.employeeAssignmentLetter.createMany({
        data: rows.map((r) => ({ employeeId: r.employeeId, date: date(r), description: r.description ?? "" })),
      })
  }
}

// Baris valid langsung disimpan, baris bermasalah dilaporkan. Baris yang
// sama persis dengan data yang sudah ada (pegawai+tanggal+isi) dilewati,
// sehingga file yang sudah diperbaiki aman diimpor ulang tanpa dobel.
export async function importHistoryWorkbook(buffer: ArrayBuffer): Promise<{ error: string } | HistoryImportResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    return { error: "File tidak bisa dibaca. Pastikan formatnya .xlsx dari template." }
  }

  const employees = await prisma.employee.findMany({
    where: { isDeleted: false },
    select: { id: true, employeeNumber: true },
  })
  const employeeByNip = new Map(employees.map((e) => [e.employeeNumber.trim(), e.id]))

  const errors: string[] = []
  let totalErrors = 0
  const pushError = (msg: string) => {
    totalErrors++
    if (errors.length < 50) errors.push(msg)
  }

  const parsed = new Map<HistoryKind, ParsedRow[]>()
  const invalidCount = new Map<HistoryKind, number>()
  let totalRows = 0
  let foundAnySheet = false

  for (const def of HISTORY_SHEETS) {
    const ws = workbook.getWorksheet(def.sheet)
    if (!ws) continue
    foundAnySheet = true
    const rows: ParsedRow[] = []
    let invalid = 0

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const values = def.columns.map((_, i) => row.getCell(i + 1).value)
      if (values.every((v) => !(v instanceof Date) && cellText(v) === "")) return // baris kosong
      // Baris contoh bawaan template (belum dihapus) dilewati diam-diam.
      if (rowNumber === 2 && def.columns.every((c, i) => cellText(values[i]) === c.example)) return

      totalRows++
      const fail = (reason: string) => {
        invalid++
        pushError(`Sheet "${def.sheet}", baris ${rowNumber}: ${reason}`)
      }

      const nip = cellText(values[0])
      if (!nip) return fail("NIP kosong.")
      const employeeId = employeeByNip.get(nip)
      if (!employeeId) return fail(`NIP "${nip}" tidak ditemukan.`)
      const date = parseCellDate(values[1])
      if (!date) return fail("Tanggal tidak valid (gunakan DD-MM-YYYY).")

      if (def.kind === "rewardPunishment") {
        const type = parseRewardType(values[2])
        const description = cellText(values[3])
        if (!type) return fail('Jenis harus "Reward" atau "Punishment".')
        if (!description) return fail("Uraian wajib diisi.")
        rows.push({ employeeId, date, type, description })
      } else if (def.kind === "mutation") {
        const oldPosition = cellText(values[2]) || null
        const newPosition = cellText(values[3]) || null
        const description = cellText(values[4]) || null
        if (!oldPosition && !newPosition && !description) {
          return fail("Isi minimal salah satu: Jabatan Lama, Jabatan Baru, atau Uraian.")
        }
        rows.push({ employeeId, date, oldPosition, newPosition, description })
      } else {
        const description = cellText(values[2])
        if (!description) return fail("Uraian wajib diisi.")
        rows.push({ employeeId, date, description })
      }
    })

    parsed.set(def.kind, rows)
    invalidCount.set(def.kind, invalid)
  }

  if (!foundAnySheet) {
    return { error: "Sheet riwayat tidak ditemukan. Gunakan file dari tombol Unduh Template." }
  }
  if (totalRows === 0) {
    return { error: "Tidak ada baris data yang diisi." }
  }
  if (totalRows > MAX_ROWS) {
    return { error: `Terlalu banyak baris (${totalRows}). Maksimal ${MAX_ROWS} baris per file — pecah menjadi beberapa file.` }
  }

  const summaries: HistoryImportSummary[] = []
  // Satu transaksi untuk semua sheet: kalau ada yang gagal di tengah, tidak
  // ada data yang setengah masuk.
  await prisma.$transaction(
    async (tx) => {
      for (const def of HISTORY_SHEETS) {
        const rows = parsed.get(def.kind) ?? []
        const employeeIds = [...new Set(rows.map((r) => r.employeeId))]
        const seen = employeeIds.length > 0 ? await existingKeys(tx, def.kind, employeeIds) : new Set<string>()
        const toInsert: ParsedRow[] = []
        let duplicates = 0
        for (const r of rows) {
          const key = dedupeKey(def.kind, r)
          if (seen.has(key)) {
            duplicates++
            continue
          }
          seen.add(key) // duplikat di dalam file yang sama juga dilewati
          toInsert.push(r)
        }
        if (toInsert.length > 0) await insertRows(tx, def.kind, toInsert)
        summaries.push({
          kind: def.kind,
          label: def.label,
          inserted: toInsert.length,
          duplicates,
          invalid: invalidCount.get(def.kind) ?? 0,
        })
      }
    },
    { timeout: 60_000 }
  )

  return { summaries, errors, totalErrors }
}
