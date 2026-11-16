import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomBytes } from "crypto"

export const MAX_ISSUE_IMAGES = 3
export const MAX_ISSUE_IMAGE_BYTES = 3 * 1024 * 1024 // 3 MB per gambar

// Ekstensi ditentukan dari JENIS GAMBAR hasil cek magic bytes (bukan dari nama
// file/MIME kiriman klien yang bisa dipalsukan) — nama file asli tidak pernah
// dipakai di path.
function detectImageExtension(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png"
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg"
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp"
  }
  return null
}

export async function saveIssueReportImages(
  files: FormDataEntryValue[],
  employeeId: number
): Promise<{ urls: string[] } | { error: string }> {
  const images = files.filter((f): f is File => f instanceof File && f.size > 0)
  if (images.length > MAX_ISSUE_IMAGES) {
    return { error: `Maksimal ${MAX_ISSUE_IMAGES} gambar.` }
  }

  const prepared: { buffer: Buffer; ext: string }[] = []
  for (const file of images) {
    if (file.size > MAX_ISSUE_IMAGE_BYTES) {
      return { error: `Ukuran gambar "${file.name}" melebihi 3 MB.` }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = detectImageExtension(buffer)
    if (!ext) {
      return { error: `"${file.name}" bukan gambar PNG, JPG, atau WebP yang valid.` }
    }
    prepared.push({ buffer, ext })
  }

  const dir = path.join(process.cwd(), "public", "uploads", "laporan-kendala")
  await mkdir(dir, { recursive: true })
  const urls: string[] = []
  for (const { buffer, ext } of prepared) {
    const fileName = `${employeeId}-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`
    await writeFile(path.join(dir, fileName), buffer)
    urls.push(`/uploads/laporan-kendala/${fileName}`)
  }
  return { urls }
}

// attachmentUrls disimpan sebagai Json — baris lama/rusak bisa null.
export function parseAttachmentUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}
