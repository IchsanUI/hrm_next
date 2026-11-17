import { randomBytes } from "crypto"
import { existsSync } from "fs"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

// Bukti klaim kesehatan (kuitansi, resep, surat dokter) — data kesehatan,
// disimpan di luar public/ dan hanya tersaji lewat
// app/api/klaim-kesehatan/dokumen/[publicId]/route.ts yang mengecek akses.
export const HEALTH_CLAIM_STORAGE_DIR = path.join(process.cwd(), "storage", "klaim-kesehatan")
export const HEALTH_CLAIM_MAX_FILE_SIZE = 5 * 1024 * 1024

// Jenis file ditentukan dari ISI (magic bytes), bukan nama/MIME dari browser.
function detectExtension(buffer: Buffer): ".pdf" | ".png" | ".jpg" | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return ".pdf"
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png"
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg"
  return null
}

export type ValidatedClaimFile = { buffer: Buffer; ext: ".pdf" | ".png" | ".jpg"; originalName: string }

// Validasi dulu SEMUA file sebelum ada yang ditulis ke disk, supaya satu file
// tidak valid tidak meninggalkan file lain yatim di storage.
export async function validateClaimFile(file: File): Promise<ValidatedClaimFile | { error: string }> {
  if (file.size > HEALTH_CLAIM_MAX_FILE_SIZE) return { error: `"${file.name}" melebihi 5 MB.` }
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = detectExtension(buffer)
  if (!ext) return { error: `"${file.name}" harus berformat PDF, JPG, atau PNG.` }
  const originalName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || `bukti${ext}`
  return { buffer, ext, originalName }
}

export async function writeClaimFile(file: ValidatedClaimFile): Promise<string> {
  await mkdir(HEALTH_CLAIM_STORAGE_DIR, { recursive: true })
  const storedFileName = `${Date.now()}-${randomBytes(8).toString("hex")}${file.ext}`
  await writeFile(path.join(HEALTH_CLAIM_STORAGE_DIR, storedFileName), file.buffer)
  return storedFileName
}

export function resolveClaimFile(storedFileName: string | null): string | null {
  if (!storedFileName || !/^[\w-]+\.(pdf|png|jpg)$/.test(storedFileName)) return null
  const filePath = path.join(HEALTH_CLAIM_STORAGE_DIR, storedFileName)
  return existsSync(filePath) ? filePath : null
}

export async function deleteClaimFile(storedFileName: string | null): Promise<void> {
  const filePath = resolveClaimFile(storedFileName)
  if (!filePath) return
  await unlink(filePath).catch(() => {})
}
