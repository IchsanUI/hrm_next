import { existsSync, statSync, createReadStream } from "fs"
import { Readable } from "stream"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// Satu-satunya cara file backup keluar dari server — dump-nya sendiri
// disimpan di storage/backups/ (di luar public/, lihat lib/backup/run-backup.ts)
// jadi TIDAK bisa diakses langsung lewat URL statis, harus lewat sini yang
// re-cek SUPER_ADMIN dulu.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hanya SUPER_ADMIN yang bisa mengunduh backup." }, { status: 403 })
  }

  const { publicId } = await params
  const backup = await prisma.backup.findUnique({ where: { publicId } })
  if (!backup || backup.status !== "SUCCESS" || !backup.filePath || !backup.fileName) {
    return NextResponse.json({ error: "Backup tidak ditemukan atau belum selesai." }, { status: 404 })
  }
  if (!existsSync(backup.filePath)) {
    return NextResponse.json({ error: "File backup tidak ditemukan di server." }, { status: 404 })
  }

  const stat = statSync(backup.filePath)
  const stream = Readable.toWeb(createReadStream(backup.filePath)) as ReadableStream

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Backup",
    description: `${session.user.username} mengunduh backup (${backup.publicId}) — cakupan ${backup.scope}.`,
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/sql",
      "Content-Disposition": `attachment; filename="${backup.fileName}"`,
      "Content-Length": String(stat.size),
    },
  })
}
