import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { canViewMemo } from "@/lib/health-claim-memo"
import { getMemoPrintData } from "@/lib/health-claim-memo-print"
import { HealthClaimMemoPdf } from "@/lib/reports/health-claim-memo-pdf"
import { appendClaimReceipts } from "@/lib/reports/health-claim-memo-attachments"
import { signPdfLib } from "@/lib/app-signature"
import { PDFDocument } from "pdf-lib"

export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { publicId } = await params
  const memo = await prisma.healthClaimMemo.findUnique({ where: { publicId }, select: { id: true, memoNumber: true } })
  if (!memo) return NextResponse.json({ error: "Nota Dinas tidak ditemukan." }, { status: 404 })
  if (!(await canViewMemo(user, memo.id))) {
    return NextResponse.json({ error: "Anda tidak punya akses ke Nota Dinas ini." }, { status: 403 })
  }

  const data = await getMemoPrintData(publicId)
  if (!data) return NextResponse.json({ error: "Nota Dinas tidak ditemukan." }, { status: 404 })

  const printedAt = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })
  // QR mengarah ke halaman verifikasi di HRIS (wajib login) — hanya untuk
  // Nota Dinas final, supaya cetakan yang beredar bisa dicek keasliannya.
  const qrCodeDataUrl = data.isFinal
    ? await QRCode.toDataURL(`${new URL(request.url).origin}/pegawai/verifikasi-nota-dinas/${publicId}`, { margin: 0, width: 200 })
    : null
  const letter = await renderToBuffer(
    <HealthClaimMemoPdf data={data} printedBy={user.username} printedAt={printedAt} qrCodeDataUrl={qrCodeDataUrl} />
  )

  // Bukti nota setiap klaim digabung di belakang surat (dua bukti per halaman)
  // supaya satu kali cetak sudah lengkap. ?lampiran=0 = surat saja.
  const withReceipts = new URL(request.url).searchParams.get("lampiran") !== "0"
  let buffer: Uint8Array = letter
  if (withReceipts) {
    const items = await prisma.healthClaimMemoItem.findMany({
      where: { memoId: memo.id },
      orderBy: { order: "asc" },
      include: {
        claim: {
          select: {
            claimNumber: true,
            patientName: true,
            employee: { select: { fullName: true } },
            claimType: { select: { name: true } },
            documents: { orderBy: { createdAt: "asc" }, select: { storedFileName: true, originalName: true } },
          },
        },
      },
    })
    const sources = items.flatMap((item, i) =>
      item.claim.documents.map((d) => ({
        label: `${i + 1}. ${item.claim.claimNumber} · ${item.claim.employee.fullName} · ${item.claim.claimType.name}`,
        storedFileName: d.storedFileName,
        originalName: d.originalName,
      }))
    )
    if (sources.length > 0) {
      const doc = await PDFDocument.load(letter, { updateMetadata: false })
      await appendClaimReceipts(doc, sources, memo.memoNumber)
      signPdfLib(doc)
      buffer = await doc.save()
    }
  }

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DOWNLOAD",
    entityType: "HealthClaimMemo",
    description: `${user.username} mencetak Nota Dinas ${memo.memoNumber}.`,
  })

  const download = new URL(request.url).searchParams.get("unduh") === "1"
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Nota Dinas ${memo.memoNumber}.pdf"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store, private",
    },
  })
}
