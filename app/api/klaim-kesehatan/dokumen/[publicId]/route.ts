import { readFile } from "fs/promises"
import path from "path"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { resolveClaimFile } from "@/lib/health-claim-storage"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { buildWatermarkLines, watermarkImage, watermarkPdf } from "@/lib/employee-document-watermark"

// Satu-satunya jalan keluar file bukti klaim kesehatan (data kesehatan).
// Selalu diberi watermark berisi pemilik & pembuka — tidak mengikuti sakelar
// watermark dokumen pribadi, karena bukti klaim tidak pernah dibutuhkan
// "bersih" untuk urusan luar.
export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { publicId } = await params
  const doc = await prisma.healthClaimDocument.findUnique({
    where: { publicId },
    select: {
      storedFileName: true,
      originalName: true,
      claim: {
        select: {
          claimNumber: true,
          employeeId: true,
          employee: { select: { fullName: true, employeeNumber: true } },
        },
      },
    },
  })
  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 })

  const isOwner = user.employeeId === doc.claim.employeeId
  const isManager =
    user.role === "SUPER_ADMIN" ||
    (user.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan")) ||
    (await isHealthClaimStaff(user.employeeId, "PETUGAS")) ||
    (await isHealthClaimStaff(user.employeeId, "ACCOUNTING"))
  if (!isOwner && !isManager) {
    return NextResponse.json({ error: "Anda tidak punya akses ke dokumen ini." }, { status: 403 })
  }

  const filePath = resolveClaimFile(doc.storedFileName)
  if (!filePath) return NextResponse.json({ error: "File tidak ditemukan di server." }, { status: 404 })

  const isPdf = path.extname(filePath) === ".pdf"
  const { headline, details } = await buildWatermarkLines({
    viewerName: user.username,
    ownerName: doc.claim.employee.fullName,
    ownerNumber: doc.claim.employee.employeeNumber,
  })

  let stamped: { buffer: Buffer; contentType: string }
  try {
    const original = await readFile(filePath)
    stamped = isPdf
      ? await watermarkPdf(original, headline, [`Bukti klaim ${doc.claim.claimNumber}`, ...details])
      : await watermarkImage(original, headline, [`Bukti klaim ${doc.claim.claimNumber}`, ...details])
  } catch (err) {
    console.error(`Gagal memberi watermark bukti klaim ${publicId}:`, err)
    return NextResponse.json({ error: "Dokumen gagal diproses. Hubungi administrator." }, { status: 500 })
  }

  if (!isOwner) {
    await logActivity({
      userId: Number(user.id),
      username: user.username,
      action: "DOWNLOAD",
      entityType: "HealthClaim",
      description: `${user.username} membuka bukti klaim ${doc.claim.claimNumber} milik "${doc.claim.employee.fullName}".`,
    })
  }

  const baseName = doc.originalName.replace(/\.[^.]+$/, "").replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "")
  return new NextResponse(new Uint8Array(stamped.buffer), {
    headers: {
      "Content-Type": stamped.contentType,
      "Content-Disposition": `inline; filename="${baseName}${stamped.contentType === "application/pdf" ? ".pdf" : ".png"}"`,
      "Content-Length": String(stamped.buffer.length),
      "Cache-Control": "no-store, private",
    },
  })
}
