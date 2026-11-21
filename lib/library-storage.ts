import { randomBytes } from "crypto"
import { existsSync } from "fs"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

// File PDF Perpustakaan disimpan di luar public/ — hanya bisa dibuka lewat
// app/api/perpustakaan/[publicId]/file/route.ts yang wajib login.
export const LIBRARY_STORAGE_DIR = path.join(process.cwd(), "storage", "perpustakaan")

// Batas server action (next.config.ts) 12mb — sisakan ruang untuk field form lain.
export const LIBRARY_MAX_FILE_SIZE = 10 * 1024 * 1024

export type LibraryUpload = { buffer: Buffer; originalName: string }

export type SavedLibraryFile = {
  storedName: string
  originalName: string
  sizeBytes: number
}

// Validasi dari ISI file (magic bytes "%PDF-"), bukan dari ekstensi/MIME yang
// bisa dipalsukan browser. Belum menulis apa pun ke disk.
export async function readLibraryUpload(file: FormDataEntryValue | null): Promise<LibraryUpload | { error: string }> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file PDF terlebih dahulu." }
  }
  if (file.size > LIBRARY_MAX_FILE_SIZE) {
    return { error: "Ukuran file maksimal 10 MB. Kompres PDF-nya terlebih dahulu." }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { error: "File harus berformat PDF." }
  }
  const originalName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "dokumen.pdf"
  return { buffer, originalName }
}

export async function writeLibraryPdf(upload: LibraryUpload): Promise<SavedLibraryFile> {
  await mkdir(LIBRARY_STORAGE_DIR, { recursive: true })
  const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}.pdf`
  await writeFile(path.join(LIBRARY_STORAGE_DIR, storedName), upload.buffer)
  return { storedName, originalName: upload.originalName, sizeBytes: upload.buffer.length }
}

// storedName dibuat sistem (lihat di atas), tapi tetap dijaga agar tidak
// pernah keluar dari folder perpustakaan.
export function resolveLibraryFile(storedName: string): string | null {
  if (!/^[\w-]+\.pdf$/.test(storedName)) return null
  const filePath = path.join(LIBRARY_STORAGE_DIR, storedName)
  return existsSync(filePath) ? filePath : null
}

export async function deleteLibraryFile(storedName: string): Promise<void> {
  const filePath = resolveLibraryFile(storedName)
  if (!filePath) return
  try {
    await unlink(filePath)
  } catch {
    // best-effort
  }
}
