import { prisma } from "@/lib/prisma"
import { isOcrEngineAvailable, ocrPdfPage } from "@/lib/library-ocr"
import { resolveLibraryFile } from "@/lib/library-storage"
import { classifyScanPages, getLibrarySettings, normalizePageText } from "@/lib/library-text"
import type { LibrarySettingsValues } from "@/lib/library-text-labels"

// Antrean OCR Perpustakaan. Dijalankan oleh lib/library-text-scheduler.ts:
// SATU dokumen per waktu, halaman demi halaman, dan bisa dilanjutkan setelah
// server restart (halaman yang sudah di-OCR tidak diulang).
//   MENUNGGU (+ ocrRequested, teks digital sudah dibaca) → diproses kapan saja.
//   DIJADWALKAN → hanya di jam malam (Pengaturan Perpustakaan).
//   DIPROSES   → dilanjutkan (terputus karena restart).

const PAUSE_BETWEEN_PAGES_MS = 250

function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

// Jendela malam bisa melewati tengah malam (mis. 18.00–06.00).
export function isInNightWindow(settings: Pick<LibrarySettingsValues, "nightStart" | "nightEnd">, now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes()
  const start = minutesOf(settings.nightStart)
  const end = minutesOf(settings.nightEnd)
  return start < end ? current >= start && current < end : current >= start || current < end
}

async function pickNextDocument(settings: LibrarySettingsValues) {
  const statuses = isInNightWindow(settings)
    ? (["DIPROSES", "MENUNGGU", "DIJADWALKAN"] as const)
    : (["DIPROSES", "MENUNGGU"] as const)
  const candidates = await prisma.libraryDocument.findMany({
    where: { ocrRequested: true, textExtractedAt: { not: null }, textStatus: { in: [...statuses] } },
    orderBy: { id: "asc" },
    take: 20,
    select: { id: true, textStatus: true },
  })
  // Lanjutkan yang terputus lebih dulu.
  return candidates.find((d) => d.textStatus === "DIPROSES") ?? candidates[0] ?? null
}

export type OcrCycleResult = { processed: boolean; documentId?: number; pages?: number; failed?: number }

let isRunning = false

export async function runLibraryOcrCycle(): Promise<OcrCycleResult> {
  if (isRunning) return { processed: false }
  const settings = await getLibrarySettings()
  if (!settings.ocrEnabled || !isOcrEngineAvailable()) return { processed: false }

  isRunning = true
  try {
    const next = await pickNextDocument(settings)
    if (!next) return { processed: false }
    const doc = await prisma.libraryDocument.findUniqueOrThrow({
      where: { id: next.id },
      select: { id: true, title: true, storedName: true, scanPageCount: true },
    })

    // Batas bisa diubah setelah dokumen masuk antrean.
    if (classifyScanPages(doc.scanPageCount ?? 0, settings) === "too_large") {
      await prisma.libraryDocument.update({
        where: { id: doc.id },
        data: { textStatus: "TANPA_OCR", ocrRequested: false, textError: `Melebihi batas OCR ${settings.ocrMaxScanPages} halaman scan.` },
      })
      return { processed: true, documentId: doc.id, pages: 0, failed: 0 }
    }

    const filePath = resolveLibraryFile(doc.storedName)
    if (!filePath) {
      await prisma.libraryDocument.update({
        where: { id: doc.id },
        data: { textStatus: "GAGAL", textError: "File PDF tidak ditemukan di server." },
      })
      return { processed: true, documentId: doc.id, pages: 0, failed: 0 }
    }

    await prisma.libraryDocument.update({ where: { id: doc.id }, data: { textStatus: "DIPROSES", textError: null } })
    const pages = await prisma.libraryDocumentPage.findMany({
      where: { documentId: doc.id, source: "NONE" },
      orderBy: { pageNumber: "asc" },
      select: { id: true, pageNumber: true },
    })

    let failed = 0
    let lastError = ""
    for (const page of pages) {
      // OCR dimatikan Super Admin di tengah jalan → berhenti, kembali ke antrean.
      const current = await getLibrarySettings()
      if (!current.ocrEnabled) {
        await prisma.libraryDocument.update({ where: { id: doc.id }, data: { textStatus: "MENUNGGU" } })
        return { processed: true, documentId: doc.id, pages: pages.length, failed }
      }
      try {
        const result = await ocrPdfPage(filePath, page.pageNumber, current.ocrPageTimeoutSec)
        await prisma.libraryDocumentPage.update({
          where: { id: page.id },
          data: { text: normalizePageText(result.text), source: "OCR", confidence: result.confidence },
        })
      } catch (error) {
        failed++
        lastError = error instanceof Error ? error.message : String(error)
      }
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_PAGES_MS))
    }

    const remaining = await prisma.libraryDocumentPage.count({ where: { documentId: doc.id, source: "NONE" } })
    await prisma.libraryDocument.update({
      where: { id: doc.id },
      data: remaining
        ? {
            textStatus: "SEBAGIAN",
            textError: `${remaining} halaman gagal di-OCR${lastError ? ` (${lastError.slice(0, 300)})` : ""}. Klik Jalankan OCR untuk mencoba lagi.`,
          }
        : { textStatus: "SELESAI", textError: null },
    })
    if (failed) console.error(`[perpustakaan] OCR "${doc.title}": ${failed} halaman gagal. ${lastError}`)
    return { processed: true, documentId: doc.id, pages: pages.length, failed }
  } finally {
    isRunning = false
  }
}
