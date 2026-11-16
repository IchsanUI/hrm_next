import { existsSync, statSync, createReadStream } from "fs"
import { Readable } from "stream"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// Satu-satunya jalan file arsip keluar dari server — disimpan di
// storage/archives/ (di luar public/), jadi tidak bisa diakses lewat URL
// statis. Pola sama dengan app/api/backup/[publicId]/download/route.ts.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya SUPER_ADMIN yang bisa mengunduh arsip." }, { status: 403 })
  }

  const { publicId } = await params
  const archive = await prisma.dataArchive.findUnique({ where: { publicId } })
  if (!archive?.filePath || !existsSync(archive.filePath)) {
    return NextResponse.json({ error: "File arsip tidak ada di server." }, { status: 404 })
  }

  const stat = statSync(archive.filePath)
  const stream = Readable.toWeb(createReadStream(archive.filePath)) as ReadableStream

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "DataArchive",
    description: `${session.user.username} mengunduh arsip ${archive.fileName}.`,
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${archive.fileName}"`,
      "Content-Length": String(stat.size),
    },
  })
}
