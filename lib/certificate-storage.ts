import { randomBytes } from "crypto"
import { existsSync } from "fs"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

// Scan sertifikat pegawai — di luar public/, hanya tersaji lewat
// app/api/sertifikasi/[publicId]/file/route.ts yang mengecek akses.
export const CERTIFICATE_STORAGE_DIR = path.join(process.cwd(), "storage", "sertifikat-pegawai")
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Jenis file ditentukan dari ISI (magic bytes), bukan nama/MIME dari browser.
function detectExtension(buffer: Buffer): ".pdf" | ".png" | ".jpg" | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return ".pdf"
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png"
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg"
  return null
}

export async function saveCertificateFile(
  file: FormDataEntryValue | null
): Promise<{ storedFileName: string; originalFileName: string } | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null
  if (file.size > MAX_FILE_SIZE) return { error: "Ukuran file sertifikat maksimal 5 MB." }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = detectExtension(buffer)
  if (!ext) return { error: "File sertifikat harus PDF, JPG, atau PNG." }

  await mkdir(CERTIFICATE_STORAGE_DIR, { recursive: true })
  const storedFileName = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`
  await writeFile(path.join(CERTIFICATE_STORAGE_DIR, storedFileName), buffer)
  const originalFileName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || `sertifikat${ext}`
  return { storedFileName, originalFileName }
}

export function resolveCertificateFile(storedFileName: string | null): string | null {
  if (!storedFileName || !/^[\w-]+\.(pdf|png|jpg)$/.test(storedFileName)) return null
  const filePath = path.join(CERTIFICATE_STORAGE_DIR, storedFileName)
  return existsSync(filePath) ? filePath : null
}

export async function deleteCertificateFile(storedFileName: string | null): Promise<void> {
  const filePath = resolveCertificateFile(storedFileName)
  if (!filePath) return
  await unlink(filePath).catch(() => {})
}
