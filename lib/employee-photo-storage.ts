import { mkdir, writeFile } from "fs/promises"
import path from "path"

import sharp from "sharp"

// Simpan pas foto pegawai (dipotong persegi 500×500, JPEG) ke
// public/uploads/pegawai — dipakai upload admin (server/actions/employee-photo.ts)
// & upload mandiri pegawai (server/actions/employee-self-update.ts).
// SENGAJA di lib/, BUKAN di file "use server": setiap export dari file
// "use server" otomatis bisa dipanggil dari browser sebagai server action.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export async function saveEmployeePhotoFile(
  file: FormDataEntryValue | null,
  employeeId: number
): Promise<{ url: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file foto terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: "Ukuran foto maksimal 5 MB." }
  }

  let resized: Buffer
  try {
    resized = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate() // ikuti orientasi EXIF foto HP
      .resize(500, 500, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    return { error: "File gambar tidak bisa dibaca." }
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "pegawai")
  await mkdir(uploadDir, { recursive: true })
  const fileName = `${employeeId}-${Date.now()}.jpg`
  await writeFile(path.join(uploadDir, fileName), resized)
  return { url: `/uploads/pegawai/${fileName}` }
}
