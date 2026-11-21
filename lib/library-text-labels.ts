import type { LibraryTextStatus } from "@prisma/client"

// Konstanta & tipe pencarian isi Perpustakaan yang aman dipakai di komponen
// klien (tanpa prisma/fs). Logika server: lib/library-text.ts.

// Halaman dengan teks lebih sedikit dari ini dianggap hasil scan (perlu OCR).
export const LIBRARY_SCAN_MIN_CHARS = 20
// Perkiraan detik OCR per halaman (1 thread) — hanya untuk tampilan estimasi.
export const LIBRARY_OCR_SECONDS_PER_PAGE = 4

export type LibrarySettingsValues = {
  ocrEnabled: boolean
  ocrDirectMaxPages: number
  ocrQueueMaxPages: number
  ocrMaxScanPages: number
  maxTotalPages: number
  nightStart: string // "HH:MM"
  nightEnd: string
  ocrPageTimeoutSec: number
}

export const LIBRARY_SETTINGS_DEFAULTS: LibrarySettingsValues = {
  ocrEnabled: true,
  ocrDirectMaxPages: 20,
  ocrQueueMaxPages: 50,
  ocrMaxScanPages: 300,
  maxTotalPages: 1000,
  nightStart: "18:00",
  nightEnd: "06:00",
  ocrPageTimeoutSec: 60,
}

// Rentang yang diizinkan (PRD bagian 4.4).
export const LIBRARY_SETTINGS_LIMITS = {
  ocrDirectMaxPages: [0, 100],
  ocrQueueMaxPages: [0, 150],
  ocrMaxScanPages: [50, 500],
  maxTotalPages: [100, 2000],
  ocrPageTimeoutSec: [30, 180],
} as const

export const LIBRARY_TEXT_STATUS_LABEL: Record<LibraryTextStatus, string> = {
  MENUNGGU: "Menunggu dibaca",
  DIPROSES: "Sedang dibaca",
  DIJADWALKAN: "OCR dijadwalkan malam",
  SELESAI: "Isi bisa dicari",
  SEBAGIAN: "Sebagian bisa dicari",
  TANPA_OCR: "Tanpa OCR",
  GAGAL: "Gagal dibaca",
}

export const LIBRARY_TEXT_STATUS_CLASS: Record<LibraryTextStatus, string> = {
  MENUNGGU: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  DIPROSES: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  DIJADWALKAN: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  SELESAI: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  SEBAGIAN: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  TANPA_OCR: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  GAGAL: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
}

export type LibraryScanClass = "none" | "direct" | "queue" | "night" | "too_large"

// Hasil pemeriksaan file sebelum disimpan (form unggah).
export type LibraryPdfCheck = {
  totalPages: number
  scanPageCount: number
  scanClass: LibraryScanClass
  /** Unggahan ditolak (total halaman melebihi batas). */
  rejectReason: string | null
  /** OCR tidak bisa dinyalakan untuk file ini; null = toggle boleh dipakai. */
  ocrLockedReason: string | null
  /** Saran pecah file bila halaman scan > batas. */
  split: { parts: number; ranges: [number, number][] } | null
  /** Keterangan singkat di bawah toggle. */
  summary: string
}

// Potongan teks hasil pencarian; `hit` = kata yang dicari (ditebalkan).
export type LibrarySnippetSegment = { text: string; hit: boolean }

export type LibrarySearchMatch = {
  publicId: string // dokumen/bagian yang memuat halaman ini
  partNumber: number | null // null = dokumen tunggal / Bagian 1 tanpa bagian lain
  page: number
  segments: LibrarySnippetSegment[]
}

export type LibrarySearchHit = {
  publicId: string // dokumen utama (Bagian 1)
  totalMatches: number
  matches: LibrarySearchMatch[] // maksimal 3 cuplikan terbaik
}
