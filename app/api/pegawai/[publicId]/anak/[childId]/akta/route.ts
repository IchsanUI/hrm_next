import { existsSync, statSync, createReadStream } from "fs"
import path from "path"
import { Readable } from "stream"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
}

// Mirror app/api/pegawai/[publicId]/dokumen/[type]/route.ts, khusus Akta
// Kelahiran anak (per anak, bukan per pegawai).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string; childId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { publicId, childId } = await params
  const child = await prisma.employeeChild.findUnique({
    where: { id: Number(childId) },
    include: { employee: { select: { id: true, publicId: true, fullName: true, employeeNumber: true } } },
  })
  if (!child || child.employee.publicId !== publicId) {
    return NextResponse.json({ error: "Data anak tidak ditemukan." }, { status: 404 })
  }

  const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "HR_ADMIN"
  const isOwner = session.user.employeeId === child.employee.id
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Anda tidak punya akses ke dokumen ini." }, { status: 403 })
  }

  if (!child.birthCertFilePath || !existsSync(child.birthCertFilePath)) {
    return NextResponse.json({ error: "Akta kelahiran belum diunggah." }, { status: 404 })
  }

  const stat = statSync(child.birthCertFilePath)
  const stream = Readable.toWeb(createReadStream(child.birthCertFilePath)) as ReadableStream
  const ext = path.extname(child.birthCertFilePath).toLowerCase()
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream"

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Employee",
    description: `${session.user.username} mengunduh akta kelahiran "${child.fullName}" (anak dari ${child.employee.fullName}, ${child.employee.employeeNumber}).`,
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="akta-${child.fullName.replace(/[^a-zA-Z0-9]/g, "_")}${ext}"`,
      "Content-Length": String(stat.size),
    },
  })
}
