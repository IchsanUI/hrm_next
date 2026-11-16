import { readFile, stat } from "fs/promises"
import path from "path"
import { PDFDocument } from "pdf-lib"

import { resolveEmployeeDocumentPath } from "@/lib/employee-document-storage"

// Metadata ringan dokumen pribadi pegawai (KTP/KK/NPWP/Surat Nikah) untuk
// kartu Dokumen Pribadi — TIDAK membuka isi dokumen ke klien, hanya jenis,
// ukuran, tanggal unggah, dan jumlah halaman PDF.

export type EmployeeDocMeta = {
  kind: "image" | "pdf" | "other"
  sizeBytes: number
  uploadedAt: string // ISO, dari waktu modifikasi file
  pages: number | null // hanya PDF
} | null

export async function getEmployeeDocMeta(storedPath: string | null): Promise<EmployeeDocMeta> {
  const filePath = resolveEmployeeDocumentPath(storedPath)
  if (!filePath) return null
  try {
    const info = await stat(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const kind = ext === ".pdf" ? "pdf" : [".jpg", ".jpeg", ".png"].includes(ext) ? "image" : "other"
    let pages: number | null = null
    if (kind === "pdf") {
      try {
        const pdf = await PDFDocument.load(await readFile(filePath), { ignoreEncryption: true, updateMetadata: false })
        pages = pdf.getPageCount()
      } catch {
        pages = null // PDF rusak/terenkripsi — tetap tampil sebagai PDF tanpa jumlah halaman
      }
    }
    return { kind, sizeBytes: info.size, uploadedAt: info.mtime.toISOString(), pages }
  } catch {
    return null // path tercatat tapi file sudah tidak ada di disk
  }
}
