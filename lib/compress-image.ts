// Kompres + resize gambar di browser sebelum diupload — foto kamera HP bisa
// beberapa MB per file, gampang nabrak batas ukuran body server action
// (lihat experimental.serverActions.bodySizeLimit di next.config.ts) kalau
// user ambil beberapa foto sekaligus. Dipakai CameraCaptureInput.
export async function compressImage(
  file: File,
  { maxDimension = 1600, quality = 0.72 }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    )
    if (!blob || blob.size >= file.size) return file // kompresi gagal/tidak lebih kecil — pakai aslinya

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg"
    return new File([blob], newName, { type: "image/jpeg" })
  } catch {
    return file // browser tidak dukung createImageBitmap/canvas — pakai aslinya
  }
}
