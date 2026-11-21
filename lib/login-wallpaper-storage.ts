import { randomBytes } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

import sharp, { type OutputInfo } from "sharp"

import { LOGIN_UPLOAD_PREFIX, LOGIN_WALLPAPER_MAX_BYTES } from "@/lib/login-appearance-shared"

// Simpan gambar login unggahan Super Admin ke public/uploads/login (volume
// persisten di Docker, disajikan app/uploads/[...path]/route.ts). Gambar
// dikecilkan ke lebar maks. 2560 px & diubah ke WebP supaya halaman login
// tetap ringan. SENGAJA di lib/, bukan file "use server".
const MAX_WIDTH = 2560
const MIN_WIDTH = 1000
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "login")

export async function saveLoginWallpaperFile(
  file: FormDataEntryValue | null
): Promise<{ url: string; width: number; height: number } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file gambar terlebih dahulu." }
  if (!file.type.startsWith("image/")) return { error: "File harus berupa gambar (JPG, PNG, atau WebP)." }
  if (file.size > LOGIN_WALLPAPER_MAX_BYTES) return { error: "Ukuran gambar maksimal 8 MB." }

  let output: { data: Buffer; info: OutputInfo }
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer())).rotate()
    const meta = await image.metadata()
    if (!meta.width || !meta.height) return { error: "File gambar tidak bisa dibaca." }
    if (meta.width < MIN_WIDTH) {
      return { error: `Lebar gambar minimal ${MIN_WIDTH} px (gambar ini ${meta.width} px) agar tidak buram di layar lebar.` }
    }
    output = await image
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    return { error: "File gambar tidak bisa dibaca." }
  }

  await mkdir(UPLOAD_DIR, { recursive: true })
  const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.webp`
  await writeFile(path.join(UPLOAD_DIR, fileName), output.data)
  return { url: `${LOGIN_UPLOAD_PREFIX}${fileName}`, width: output.info.width, height: output.info.height }
}

// Hanya file di uploads/login yang dihapus; gambar bawaan di public/ tidak.
export async function deleteLoginWallpaperFile(url: string) {
  if (!url.startsWith(LOGIN_UPLOAD_PREFIX)) return
  const name = url.slice(LOGIN_UPLOAD_PREFIX.length)
  if (!/^[\w-]+\.webp$/.test(name)) return
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {})
}
