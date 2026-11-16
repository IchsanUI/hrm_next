import { createReadStream, statSync } from "fs"
import { Readable } from "stream"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveLibraryFile } from "@/lib/library-storage"

// Satu kali "baca" dihitung paling sering tiap 30 menit per pegawai, supaya
// muat-ulang viewer tidak menggelembungkan angka.
const READ_DEDUPE_MS = 30 * 60 * 1000

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { publicId } = await params
  const doc = await prisma.libraryDocument.findUnique({ where: { publicId } })
  const user = session.user
  const isManager =
    user.role === "SUPER_ADMIN" ||
    (user.role === "HR_ADMIN" && user.menuAccess.includes("perpustakaan.kelola"))

  // Draf hanya terlihat oleh pengelola — pegawai lain dapat 404 yang sama
  // dengan dokumen yang tidak ada.
  if (!doc || (!doc.isPublished && !isManager)) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 })
  }

  const filePath = resolveLibraryFile(doc.storedName)
  if (!filePath) {
    return NextResponse.json({ error: "File dokumen tidak ditemukan di server." }, { status: 404 })
  }

  if (user.employeeId && doc.isPublished) {
    try {
      const existing = await prisma.libraryDocumentRead.findUnique({
        where: { documentId_employeeId: { documentId: doc.id, employeeId: user.employeeId } },
      })
      if (!existing) {
        await prisma.libraryDocumentRead.create({
          data: { documentId: doc.id, employeeId: user.employeeId },
        })
      } else if (Date.now() - existing.lastReadAt.getTime() > READ_DEDUPE_MS) {
        await prisma.libraryDocumentRead.update({
          where: { id: existing.id },
          data: { lastReadAt: new Date(), readCount: { increment: 1 } },
        })
      }
    } catch (err) {
      // Jejak baca best-effort — gagal mencatat tidak boleh menghalangi membaca.
      console.error("Gagal mencatat jejak baca perpustakaan:", err)
    }
  }

  const download = new URL(request.url).searchParams.get("download") === "1"
  const safeName = doc.originalName.replace(/["\\\r\n]/g, "_")
  const stat = statSync(filePath)
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
