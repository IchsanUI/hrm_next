import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

// Penyimpanan file dokumen pribadi pegawai (KTP, KK, NPWP, Surat Nikah/Akta
// Cerai, Akta Kelahiran anak) — SENGAJA di luar public/ (beda dari
// lib/file-upload.ts yang dipakai foto/TTD/dokumen riwayat kerja), karena
// dokumen ini jauh lebih sensitif (risiko pencurian identitas kalau bocor).
// Cuma bisa diakses lewat route yang wajib login — lihat
// app/api/pegawai/[publicId]/dokumen/[type]/route.ts — sama pola dengan
// storage/backups/ punya Backup Manual (lib/backup/run-backup.ts).
const DOCUMENT_STORAGE_DIR = path.join(process.cwd(), "storage", "dokumen-pegawai")

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"]

export type SaveDocumentResult = { filePath: string } | { error: string }

// LEBIH KETAT dibanding lib/file-upload.ts (yang tidak validasi ukuran/tipe
// sama sekali) — sengaja, karena ini dokumen identitas resmi, bukan foto
// biasa.
export async function saveEmployeeDocument(
  file: FormDataEntryValue | null,
  subDir: string,
  employeeId: number
): Promise<SaveDocumentResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file terlebih dahulu." }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "Ukuran file maksimal 5MB." }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Format file harus PDF, JPG, atau PNG." }
  }

  const dir = path.join(DOCUMENT_STORAGE_DIR, subDir)
  await mkdir(dir, { recursive: true })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const fileName = `${employeeId}-${Date.now()}-${safeName}`
  const filePath = path.join(dir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return { filePath }
}

// Best-effort — dipanggil sebelum menimpa field lama saat re-upload, supaya
// scan dokumen lama tidak menumpuk selamanya di disk. Gagal diam-diam kalau
// file-nya sudah tidak ada (mis. sudah dihapus manual).
export async function deleteEmployeeDocumentIfExists(filePath: string | null): Promise<void> {
  if (!filePath) return
  try {
    await unlink(filePath)
  } catch {
    // diamkan — bukan aksi utama, tidak boleh menggagalkan upload baru
  }
}
