import { createReadStream } from "fs"
import { stat } from "fs/promises"
import path from "path"
import { Readable } from "stream"

// Penyaji file upload (public/uploads/**) saat RUNTIME.
//
// KENAPA PERLU: di production (`next start`) Next.js hanya memindai isi
// folder public/ SEKALI saat server menyala (lihat
// next/dist/server/lib/router-utils/filesystem.js → publicFolderItems).
// File yang diunggah SETELAH itu (foto pegawai, TTD, lampiran, dst) tidak
// dikenali → 404 / gambar rusak sampai container di-restart. Di `next dev`
// tidak terjadi karena folder dicek tiap request.
//
// File yang sudah ada saat server start tetap disajikan Next.js langsung;
// route ini hanya menangkap sisanya. Perilaku akses sama seperti public/
// (tanpa login) — dokumen sensitif memang disimpan di luar public/.

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads")

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path ?? []

  // Cegah path traversal ("..", path absolut, backslash Windows).
  const absolute = path.resolve(UPLOADS_ROOT, ...segments)
  if (!absolute.startsWith(UPLOADS_ROOT + path.sep)) {
    return new Response("Not Found", { status: 404 })
  }

  let size: number
  try {
    const info = await stat(absolute)
    if (!info.isFile()) return new Response("Not Found", { status: 404 })
    size = info.size
  } catch {
    return new Response("Not Found", { status: 404 })
  }

  const ext = path.extname(absolute).toLowerCase()
  const contentType = CONTENT_TYPES[ext]
  const headers: Record<string, string> = {
    "Content-Type": contentType ?? "application/octet-stream",
    "Content-Length": String(size),
    // Nama file upload selalu unik (mengandung timestamp), aman di-cache.
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  }
  // SVG bisa berisi script — jalankan dalam sandbox supaya tidak bisa XSS.
  if (ext === ".svg") headers["Content-Security-Policy"] = "sandbox"
  // Tipe tak dikenal → paksa unduh, jangan dirender browser.
  if (!contentType) headers["Content-Disposition"] = "attachment"

  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream
  return new Response(stream, { headers })
}
