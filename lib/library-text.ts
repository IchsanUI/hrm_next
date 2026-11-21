import { readFile } from "fs/promises"
import type { LibraryTextStatus } from "@prisma/client"
import { extractText, getDocumentProxy } from "unpdf"

import { prisma } from "@/lib/prisma"
import { resolveLibraryFile } from "@/lib/library-storage"
import {
  LIBRARY_OCR_SECONDS_PER_PAGE,
  LIBRARY_SCAN_MIN_CHARS,
  LIBRARY_SETTINGS_DEFAULTS,
  type LibraryPdfCheck,
  type LibraryScanClass,
  type LibrarySettingsValues,
} from "@/lib/library-text-labels"

// Pembacaan teks dokumen Perpustakaan (docs/prd-ocr-perpustakaan.md, Tahap 1).
// Teks bawaan PDF digital dibaca dengan pdf.js (unpdf) — ringan, tanpa paket
// sistem. Halaman tanpa teks (hasil scan) disimpan kosong (source NONE);
// bila pengunggah meminta OCR, halaman itu dibaca kemudian oleh antrean OCR
// (lib/library-ocr-worker.ts). Tanpa OCR, dokumennya berstatus TANPA_OCR.

// ─── Pengaturan (cache singkat, seperti lib/session-policy.ts) ────────────
const CACHE_TTL_MS = 60_000
let cachedSettings: { value: LibrarySettingsValues; at: number } | null = null

export async function getLibrarySettings(): Promise<LibrarySettingsValues> {
  if (cachedSettings && Date.now() - cachedSettings.at < CACHE_TTL_MS) return cachedSettings.value
  const row = await prisma.librarySettings.findUnique({ where: { id: 1 } })
  const value: LibrarySettingsValues = row
    ? {
        ocrEnabled: row.ocrEnabled,
        ocrDirectMaxPages: row.ocrDirectMaxPages,
        ocrQueueMaxPages: Math.max(row.ocrQueueMaxPages, row.ocrDirectMaxPages),
        ocrMaxScanPages: row.ocrMaxScanPages,
        maxTotalPages: row.maxTotalPages,
        nightStart: row.nightStart,
        nightEnd: row.nightEnd,
        ocrPageTimeoutSec: row.ocrPageTimeoutSec,
      }
    : LIBRARY_SETTINGS_DEFAULTS
  cachedSettings = { value, at: Date.now() }
  return value
}

export function invalidateLibrarySettingsCache() {
  cachedSettings = null
}

// Mesin OCR (tesseract + pdftoppm) dipasang di image Docker. Selama belum
// ada, toggle OCR di form unggah terkunci. Lihat lib/library-ocr.ts.
export { isOcrEngineAvailable } from "@/lib/library-ocr"

// ─── Analisis PDF ─────────────────────────────────────────────────────────
export type PdfTextAnalysis = {
  totalPages: number
  pages: string[] // teks per halaman (index 0 = halaman 1), sudah dirapikan
  scanPages: number[] // nomor halaman (1-based) tanpa teks
}

// Rapikan teks hasil ekstraksi: sambung kata yang terpotong tanda hubung di
// akhir baris, satukan spasi/baris baru supaya cuplikan enak dibaca.
export function normalizePageText(raw: string): string {
  return raw
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
}

export async function analyzePdfText(buffer: Buffer | Uint8Array): Promise<PdfTextAnalysis> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer), { verbosity: 0 })
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false })
    const pages = text.map(normalizePageText)
    const scanPages = pages.flatMap((t, i) => (t.length < LIBRARY_SCAN_MIN_CHARS ? [i + 1] : []))
    return { totalPages, pages, scanPages }
  } finally {
    await Promise.resolve((pdf as { destroy?: () => Promise<void> }).destroy?.()).catch(() => {})
  }
}

export function classifyScanPages(scanCount: number, settings: LibrarySettingsValues): LibraryScanClass {
  if (scanCount === 0) return "none"
  if (scanCount > settings.ocrMaxScanPages) return "too_large"
  if (scanCount <= settings.ocrDirectMaxPages) return "direct"
  if (scanCount <= settings.ocrQueueMaxPages) return "queue"
  return "night"
}

function splitRanges(totalPages: number, parts: number): [number, number][] {
  const size = Math.ceil(totalPages / parts)
  return Array.from({ length: parts }, (_, i) => [i * size + 1, Math.min(totalPages, (i + 1) * size)] as [number, number]).filter(
    ([a, b]) => a <= b
  )
}

function minutesLabel(pages: number) {
  const minutes = Math.max(1, Math.round((pages * LIBRARY_OCR_SECONDS_PER_PAGE) / 60))
  return `±${minutes} menit`
}

// Ringkasan untuk form unggah: batas, kunci toggle OCR, dan saran pecah file.
export function buildPdfCheck(
  analysis: Pick<PdfTextAnalysis, "totalPages" | "scanPages">,
  settings: LibrarySettingsValues,
  ocrEngineAvailable: boolean
): LibraryPdfCheck {
  const { totalPages } = analysis
  const scanPageCount = analysis.scanPages.length
  const scanClass = classifyScanPages(scanPageCount, settings)

  const rejectReason =
    totalPages > settings.maxTotalPages
      ? `File ini berisi ${totalPages} halaman (batas ${settings.maxTotalPages}). Pecah menjadi ${Math.ceil(totalPages / settings.maxTotalPages)} bagian lalu unggah sebagai Bagian 1, Bagian 2, dan seterusnya.`
      : null

  const split =
    scanClass === "too_large"
      ? (() => {
          const parts = Math.ceil(scanPageCount / settings.ocrMaxScanPages)
          return { parts, ranges: splitRanges(totalPages, parts) }
        })()
      : null

  const ocrLockedReason =
    scanPageCount === 0
      ? "PDF digital — isi langsung bisa dicari, tanpa OCR."
      : scanClass === "too_large"
        ? `File ini berisi ${scanPageCount} halaman scan (batas OCR ${settings.ocrMaxScanPages}).`
        : !settings.ocrEnabled
          ? "OCR sedang dinonaktifkan oleh Super Admin."
          : !ocrEngineAvailable
            ? "Mesin OCR belum terpasang di server. Halaman scan belum bisa dicari isinya."
            : null

  const pagesLabel = `${totalPages} halaman`
  const summary =
    scanPageCount === 0
      ? `${pagesLabel} · PDF digital — isi langsung bisa dicari.`
      : scanClass === "too_large"
        ? `${pagesLabel} · ${scanPageCount} halaman scan.`
        : scanClass === "night"
          ? `${pagesLabel} · ${scanPageCount} halaman scan · OCR dijadwalkan malam (${minutesLabel(scanPageCount)}).`
          : `${pagesLabel} · ${scanPageCount} halaman scan · OCR ${minutesLabel(scanPageCount)}.`

  return { totalPages, scanPageCount, scanClass, rejectReason, ocrLockedReason, split, summary }
}

// Status setelah teks digital tersimpan. OCR yang diminta (Tahap 2)
// menunggu antrean/jadwal malam; tanpa OCR, halaman scan tidak bisa dicari.
export function statusAfterExtraction(scanCount: number, ocrRequested: boolean, scanClass: LibraryScanClass): LibraryTextStatus {
  if (scanCount === 0) return "SELESAI"
  if (!ocrRequested) return "TANPA_OCR"
  return scanClass === "night" ? "DIJADWALKAN" : "MENUNGGU"
}

// ─── Simpan teks ──────────────────────────────────────────────────────────
const INSERT_CHUNK = 200

export async function storeDocumentText(documentId: number, analysis: PdfTextAnalysis, ocrRequested: boolean) {
  const settings = await getLibrarySettings()
  const scanClass = classifyScanPages(analysis.scanPages.length, settings)
  const scanSet = new Set(analysis.scanPages)
  const rows = analysis.pages.map((text, i) => ({
    documentId,
    pageNumber: i + 1,
    text: scanSet.has(i + 1) ? "" : text,
    source: scanSet.has(i + 1) ? ("NONE" as const) : ("TEXT_LAYER" as const),
  }))

  await prisma.$transaction(async (tx) => {
    await tx.libraryDocumentPage.deleteMany({ where: { documentId } })
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      await tx.libraryDocumentPage.createMany({ data: rows.slice(i, i + INSERT_CHUNK) })
    }
    await tx.libraryDocument.update({
      where: { id: documentId },
      data: {
        pageCount: analysis.totalPages,
        scanPageCount: analysis.scanPages.length,
        ocrRequested: ocrRequested && scanClass !== "too_large",
        textStatus: statusAfterExtraction(analysis.scanPages.length, ocrRequested && scanClass !== "too_large", scanClass),
        textError: null,
        textExtractedAt: new Date(),
      },
    })
  }, { timeout: 60_000 })
}

// Baca ulang dari file tersimpan (dokumen lama / tombol Baca Ulang).
export async function extractDocumentTextFromFile(documentId: number): Promise<{ ok: true } | { error: string }> {
  const doc = await prisma.libraryDocument.findUnique({ where: { id: documentId }, select: { storedName: true, ocrRequested: true } })
  if (!doc) return { error: "Dokumen tidak ditemukan." }
  const filePath = resolveLibraryFile(doc.storedName)
  if (!filePath) {
    await prisma.libraryDocument.update({ where: { id: documentId }, data: { textStatus: "GAGAL", textError: "File PDF tidak ditemukan di server." } })
    return { error: "File PDF tidak ditemukan di server." }
  }

  await prisma.libraryDocument.update({ where: { id: documentId }, data: { textStatus: "DIPROSES" } })
  try {
    const analysis = await analyzePdfText(await readFile(filePath))
    await storeDocumentText(documentId, analysis, doc.ocrRequested)
    return { ok: true }
  } catch (error) {
    const message = describePdfError(error)
    await prisma.libraryDocument.update({ where: { id: documentId }, data: { textStatus: "GAGAL", textError: message.slice(0, 500) } })
    return { error: message }
  }
}

export function describePdfError(error: unknown): string {
  const name = (error as { name?: string })?.name ?? ""
  if (name === "PasswordException") return "PDF dilindungi password, teksnya tidak bisa dibaca."
  if (name === "InvalidPDFException") return "File PDF rusak atau tidak valid."
  return `Teks PDF gagal dibaca: ${error instanceof Error ? error.message : String(error)}`
}
