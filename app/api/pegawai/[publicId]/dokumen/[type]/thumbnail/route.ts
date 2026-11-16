import path from "path"
import sharp from "sharp"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveEmployeeDocumentPath } from "@/lib/employee-document-storage"

// Thumbnail KECIL & DIBURAMKAN untuk kartu Dokumen Pribadi — cukup untuk
// menunjukkan dokumen sudah ada & jenisnya, tapi isinya (NIK, alamat, dst)
// TIDAK terbaca. Karena itu sengaja tidak memberi watermark dan tidak
// dicatat sebagai "unduhan" di Log Aktivitas; melihat isi asli tetap wajib
// lewat route dokumen utama (../route.ts) yang ber-watermark & tercatat.
// Hanya untuk dokumen gambar — PDF ditampilkan sebagai tile di klien.

const FIELD_BY_TYPE = {
  ktp: "ktpFilePath",
  kk: "kkFilePath",
  npwp: "npwpFilePath",
  marital: "maritalDocumentFilePath",
} as const

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png"])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string; type: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { publicId, type } = await params
  if (!(type in FIELD_BY_TYPE)) {
    return NextResponse.json({ error: "Jenis dokumen tidak dikenali." }, { status: 404 })
  }
  const field = FIELD_BY_TYPE[type as keyof typeof FIELD_BY_TYPE]

  const employee = await prisma.employee.findUnique({
    where: { publicId },
    select: { id: true, ktpFilePath: true, kkFilePath: true, npwpFilePath: true, maritalDocumentFilePath: true },
  })
  if (!employee) {
    return NextResponse.json({ error: "Data pegawai tidak ditemukan." }, { status: 404 })
  }

  // Aturan akses sama persis dengan route dokumen utama.
  const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "HR_ADMIN"
  const isOwner = session.user.employeeId === employee.id
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Anda tidak punya akses ke dokumen ini." }, { status: 403 })
  }

  const filePath = resolveEmployeeDocumentPath(employee[field])
  if (!filePath || !IMAGE_EXT.has(path.extname(filePath).toLowerCase())) {
    return NextResponse.json({ error: "Thumbnail tidak tersedia." }, { status: 404 })
  }

  try {
    const thumb = await sharp(filePath)
      .rotate() // ikuti orientasi EXIF foto HP
      .resize(240, 150, { fit: "cover" })
      .blur(6)
      .webp({ quality: 45 })
      .toBuffer()
    return new NextResponse(new Uint8Array(thumb), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(thumb.length),
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch {
    return NextResponse.json({ error: "Thumbnail gagal dibuat." }, { status: 500 })
  }
}
