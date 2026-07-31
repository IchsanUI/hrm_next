import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { getPayslipPrintDocument } from "@/lib/payroll/payslip-print"
import { PayslipPdfDocument } from "@/lib/reports/payslip-pdf"

function sanitizeFileNamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").trim()
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const payslipId = Number(id)
  if (!Number.isInteger(payslipId)) {
    return NextResponse.json({ error: "ID slip gaji tidak valid." }, { status: 400 })
  }

  const role = session.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"

  // Non-admin cuma boleh unduh slip gaji MILIK SENDIRI, dan cuma kalau
  // periode-nya sudah LOCKED (final/disetujui) — sama aturan dengan halaman
  // Slip Gaji pegawai (app/pegawai/slip-gaji/page.tsx) & tombol Unduh yang
  // disabled sebelum LOCKED.
  if (!isAdminRole) {
    const payslipOwner = await prisma.payslip.findUnique({
      where: { id: payslipId },
      select: { employeeId: true, payrollPeriod: { select: { status: true } } },
    })
    const isOwner = payslipOwner?.employeeId === session.user.employeeId
    if (!payslipOwner || !isOwner || payslipOwner.payrollPeriod.status !== "LOCKED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const doc = await getPayslipPrintDocument(payslipId)
  if (!doc) {
    return NextResponse.json({ error: "Slip gaji tidak ditemukan." }, { status: 404 })
  }

  // QR code dikodekan dari nomor slip (bukan URL — belum ada halaman verifikasi
  // publik) — dibuat SEBELUM render karena QRCode.toDataURL async, sementara
  // JSX komponen react-pdf sendiri harus sync.
  const qrCodeDataUrl = await QRCode.toDataURL(doc.slipNumber, { margin: 0, width: 160 })

  const buffer = await renderToBuffer(
    <PayslipPdfDocument doc={doc} generatedBy={session.user.username} qrCodeDataUrl={qrCodeDataUrl} />
  )

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${session.user.username} mengunduh PDF Slip Gaji "${doc.employeeName}" periode ${doc.paymentDateLabel}.`,
  })

  const fileName = `Slip Gaji_${sanitizeFileNamePart(doc.employeeName)}_${sanitizeFileNamePart(doc.paymentDateLabel)}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
