import { readFile } from "fs/promises"
import path from "path"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canViewMemo } from "@/lib/health-claim-memo"
import { resolveClaimFile } from "@/lib/health-claim-storage"
import { watermarkImage, watermarkPdf } from "@/lib/employee-document-watermark"

// Bukti pembayaran Nota Dinas (bukti transfer / cetakan jurnal CBS).
export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { publicId } = await params
  const proof = await prisma.healthClaimPaymentProof.findUnique({
    where: { publicId },
    select: { storedFileName: true, originalName: true, memoId: true, memo: { select: { memoNumber: true } } },
  })
  if (!proof) return NextResponse.json({ error: "Bukti tidak ditemukan." }, { status: 404 })
  if (!(await canViewMemo(user, proof.memoId))) return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 })
  const filePath = resolveClaimFile(proof.storedFileName)
  if (!filePath) return NextResponse.json({ error: "File tidak ditemukan di server." }, { status: 404 })

  const stamp = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })
  const details = [`Bukti bayar Nota Dinas ${proof.memo.memoNumber}`, `Dibuka oleh ${user.username} · ${stamp}`]
  const original = await readFile(filePath)
  const stamped =
    path.extname(filePath) === ".pdf"
      ? await watermarkPdf(original, "RAHASIA", details)
      : await watermarkImage(original, "RAHASIA", details)
  return new NextResponse(new Uint8Array(stamped.buffer), {
    headers: {
      "Content-Type": stamped.contentType,
      "Content-Disposition": `inline; filename="bukti-${proof.memo.memoNumber}${stamped.contentType === "application/pdf" ? ".pdf" : ".png"}"`,
      "Cache-Control": "no-store, private",
    },
  })
}
