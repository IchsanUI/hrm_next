import { prisma } from "@/lib/prisma"
import { extractDocumentTextFromFile } from "@/lib/library-text"
import { runLibraryOcrCycle } from "@/lib/library-ocr-worker"

// Pekerja latar belakang Perpustakaan (satu loop per proses server):
// 1. Backfill — baca teks digital dokumen yang belum pernah dibaca (dokumen
//    lama, atau terputus karena restart). Dokumen baru sudah dibaca saat unggah.
// 2. Antrean OCR — satu dokumen per putaran (lib/library-ocr-worker.ts).
// Pola sama dengan lib/certification-reminder-scheduler.ts; kickLibraryWorker()
// membangunkan loop lebih awal setelah ada unggahan/permintaan OCR baru.
const IDLE_INTERVAL_MS = 60 * 1000
const BUSY_INTERVAL_MS = 3 * 1000
const FIRST_RUN_DELAY_MS = 60 * 1000
const BACKFILL_BATCH = 10

declare global {
  var __libraryTextSchedulerStarted: boolean | undefined
  var __libraryWorkerTimer: ReturnType<typeof setTimeout> | undefined
  var __libraryWorkerBusy: boolean | undefined
}

let isBackfilling = false

export async function runLibraryTextBackfill(): Promise<{ processed: number }> {
  if (isBackfilling) return { processed: 0 }
  isBackfilling = true
  try {
    // DIPROSES tanpa textExtractedAt = terputus di tengah jalan (restart).
    const docs = await prisma.libraryDocument.findMany({
      where: { textExtractedAt: null, textStatus: { in: ["MENUNGGU", "DIPROSES"] } },
      orderBy: { id: "asc" },
      take: BACKFILL_BATCH,
      select: { id: true, title: true },
    })
    for (const doc of docs) {
      const result = await extractDocumentTextFromFile(doc.id)
      if ("error" in result) console.error(`[perpustakaan] gagal membaca teks "${doc.title}": ${result.error}`)
    }
    return { processed: docs.length }
  } finally {
    isBackfilling = false
  }
}

async function tick() {
  if (globalThis.__libraryWorkerBusy) return
  globalThis.__libraryWorkerBusy = true
  let busy = false
  try {
    const backfill = await runLibraryTextBackfill()
    const ocr = await runLibraryOcrCycle()
    busy = backfill.processed === BACKFILL_BATCH || ocr.processed
  } catch (error) {
    console.error("[perpustakaan] pekerja latar belakang gagal:", error)
  } finally {
    globalThis.__libraryWorkerBusy = false
    schedule(busy ? BUSY_INTERVAL_MS : IDLE_INTERVAL_MS)
  }
}

function schedule(delayMs: number) {
  if (globalThis.__libraryWorkerTimer) clearTimeout(globalThis.__libraryWorkerTimer)
  globalThis.__libraryWorkerTimer = setTimeout(tick, delayMs)
}

export function startLibraryTextBackfill() {
  if (globalThis.__libraryTextSchedulerStarted) return
  globalThis.__libraryTextSchedulerStarted = true
  schedule(FIRST_RUN_DELAY_MS)
}

// Bangunkan pekerja sekarang (mis. setelah unggah dokumen dengan OCR). Aman
// dipanggil berkali-kali; bila sedang bekerja, putaran berikutnya menyusul.
export function kickLibraryWorker() {
  if (!globalThis.__libraryTextSchedulerStarted) return
  if (!globalThis.__libraryWorkerBusy) schedule(1000)
}
