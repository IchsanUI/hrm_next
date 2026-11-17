import { createReadStream, statSync } from "fs"
import path from "path"
import { Readable } from "stream"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveCertificateFile } from "@/lib/certificate-storage"

const CONTENT_TYPE: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
}

// Scan sertifikat: pengelola Sertifikasi, atau pegawai pemiliknya sendiri.
export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { publicId } = await params
  const cert = await prisma.employeeCertification.findUnique({
    where: { publicId },
    select: { employeeId: true, storedFileName: true, originalFileName: true },
  })
  const isManager =
    user.role === "SUPER_ADMIN" ||
    (user.role === "HR_ADMIN" && user.menuAccess.includes("kepegawaian.sertifikasi"))
  if (!cert || (!isManager && user.employeeId !== cert.employeeId)) {
    return NextResponse.json({ error: "Sertifikat tidak ditemukan." }, { status: 404 })
  }

  const filePath = resolveCertificateFile(cert.storedFileName)
  if (!filePath) return NextResponse.json({ error: "File sertifikat belum diunggah." }, { status: 404 })

  const ext = path.extname(filePath).toLowerCase()
  const name = cert.originalFileName ?? `sertifikat${ext}`
  return new NextResponse(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: {
      "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${name.replace(/["\\\r\n]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Content-Length": String(statSync(filePath).size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
