import { existsSync, statSync, createReadStream } from "fs"
import path from "path"
import { Readable } from "stream"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// Satu-satunya cara dokumen KTP/KK/NPWP/Surat Nikah-Cerai keluar dari
// server — file-nya disimpan di storage/dokumen-pegawai/ (di luar public/,
// lihat lib/employee-document-storage.ts) jadi TIDAK bisa diakses langsung
// lewat URL statis, harus lewat sini yang re-cek akses dulu. Mirip pola
// app/api/backup/[publicId]/download/route.ts.
const FIELD_BY_TYPE = {
  ktp: "ktpFilePath",
  kk: "kkFilePath",
  npwp: "npwpFilePath",
  marital: "maritalDocumentFilePath",
} as const

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
}

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

  // Select ke-4 field-nya secara statis (bukan computed key) — Prisma tidak
  // bisa menyempitkan tipe balikan dengan benar untuk select key dinamis
  // ([field]: true), hasilnya union raksasa yang bikin TS error di bawah.
  const employee = await prisma.employee.findUnique({
    where: { publicId },
    select: {
      id: true,
      fullName: true,
      employeeNumber: true,
      ktpFilePath: true,
      kkFilePath: true,
      npwpFilePath: true,
      maritalDocumentFilePath: true,
    },
  })
  if (!employee) {
    return NextResponse.json({ error: "Data pegawai tidak ditemukan." }, { status: 404 })
  }

  const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "HR_ADMIN"
  const isOwner = session.user.employeeId === employee.id
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Anda tidak punya akses ke dokumen ini." }, { status: 403 })
  }

  const filePath = employee[field]
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "Dokumen belum diunggah." }, { status: 404 })
  }

  const stat = statSync(filePath)
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream
  const ext = path.extname(filePath).toLowerCase()
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream"

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Employee",
    description: `${session.user.username} mengunduh dokumen ${type.toUpperCase()} milik "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${type}-${employee.employeeNumber}${ext}"`,
      "Content-Length": String(stat.size),
    },
  })
}
