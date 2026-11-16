import type { LibraryCategory } from "@prisma/client"

// Label & helper Perpustakaan yang aman dipakai di komponen klien (tanpa fs).

export const LIBRARY_CATEGORY_LABEL: Record<LibraryCategory, string> = {
  OJK: "Peraturan OJK",
  PERATURAN_PERUSAHAAN: "Peraturan Perusahaan",
  SOP: "SOP",
  SURAT_EDARAN: "Surat Edaran",
  LAINNYA: "Lainnya",
}

export const LIBRARY_CATEGORY_HINT: Record<LibraryCategory, string> = {
  OJK: "POJK, SEOJK, dan ketentuan regulator",
  PERATURAN_PERUSAHAAN: "PP, SK Direksi, kebijakan internal",
  SOP: "Prosedur kerja operasional",
  SURAT_EDARAN: "Pengumuman & edaran internal",
  LAINNYA: "Dokumen bacaan lain",
}

export const LIBRARY_CATEGORIES = Object.keys(LIBRARY_CATEGORY_LABEL) as LibraryCategory[]

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}
