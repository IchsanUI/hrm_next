import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { signWorkbook } from "@/lib/app-signature"
import { getComplianceOverview } from "@/lib/certification-compliance"
import {
  CERTIFICATE_STATUS_LABEL,
  COMPLIANCE_STATUS_LABEL,
  KIND_LABEL,
  certificateStatus,
  startOfTodayUtc,
} from "@/lib/certification-status"
import { COMPANY_NAME } from "@/lib/reports/employee-report"

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172554" } }

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(4)
  row.font = { bold: true, color: { argb: "FFFFFFFF" } }
  row.fill = HEADER_FILL
  row.alignment = { vertical: "middle" }
  sheet.views = [{ state: "frozen", ySplit: 4 }]
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: sheet.columnCount } }
}

function addTitle(sheet: ExcelJS.Worksheet, title: string, printedAt: string) {
  sheet.getCell("A1").value = `${title} — ${COMPANY_NAME}`
  sheet.getCell("A1").font = { bold: true, size: 13 }
  sheet.getCell("A2").value = `Dicetak ${printedAt}`
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } }
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : "Selamanya"

// Rekap kepatuhan sertifikasi untuk pemeriksaan (OJK/audit internal).
export async function GET() {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "HR_ADMIN" && user.menuAccess.includes("kepegawaian.sertifikasi"))
  if (!user || !allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const overview = await getComplianceOverview()
  const certificates = await prisma.employeeCertification.findMany({
    where: { employee: { isActive: true, isDeleted: false } },
    include: {
      employee: { select: { fullName: true, employeeNumber: true, position: { select: { name: true } } } },
      certificationType: { select: { name: true, kind: true, reminderDays: true } },
    },
    orderBy: [{ employee: { fullName: "asc" } }, { issuedDate: "desc" }],
  })
  const today = startOfTodayUtc()
  const printedAt = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })

  const wb = new ExcelJS.Workbook()
  signWorkbook(wb)

  const summary = wb.addWorksheet("Ringkasan")
  addTitle(summary, "Rekap Kepatuhan Sertifikasi & Pelatihan Wajib", printedAt)
  summary.getRow(4).values = ["Sertifikasi/Pelatihan", "Jenis", "Wajib", "Terpenuhi", "Segera Kedaluwarsa", "Kedaluwarsa", "Belum Ada", "Kepatuhan"]
  summary.columns = [{ width: 44 }, { width: 13 }, { width: 9 }, { width: 11 }, { width: 19 }, { width: 13 }, { width: 11 }, { width: 12 }]
  for (const s of overview.summaries) {
    // "Segera kedaluwarsa" masih berlaku → dihitung patuh.
    const compliant = s.TERPENUHI + s.SEGERA
    summary.addRow([s.name, KIND_LABEL[s.kind], s.required, s.TERPENUHI, s.SEGERA, s.KEDALUWARSA, s.BELUM_ADA, s.required ? compliant / s.required : 1])
  }
  summary.getColumn(8).numFmt = "0%"
  styleHeader(summary)

  const detail = wb.addWorksheet("Kewajiban per Pegawai")
  addTitle(detail, "Kewajiban Sertifikasi per Pegawai", printedAt)
  detail.getRow(4).values = ["Nama", "NIP", "Jabatan", "Bagian", "Sertifikasi/Pelatihan", "Status", "Berlaku s.d."]
  detail.columns = [{ width: 28 }, { width: 14 }, { width: 22 }, { width: 22 }, { width: 40 }, { width: 19 }, { width: 14 }]
  for (const r of overview.rows) {
    detail.addRow([
      r.employeeName,
      r.employeeNumber,
      r.position,
      r.department,
      r.typeName,
      COMPLIANCE_STATUS_LABEL[r.status],
      r.status === "BELUM_ADA" ? "-" : fmt(r.expiryDate),
    ])
  }
  styleHeader(detail)

  const list = wb.addWorksheet("Daftar Sertifikat")
  addTitle(list, "Daftar Sertifikat Pegawai", printedAt)
  list.getRow(4).values = ["Nama", "NIP", "Jabatan", "Sertifikasi/Pelatihan", "Jenis", "No. Sertifikat", "Penyelenggara", "Terbit", "Berlaku s.d.", "Status"]
  list.columns = [{ width: 28 }, { width: 14 }, { width: 22 }, { width: 40 }, { width: 12 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 19 }]
  for (const c of certificates) {
    list.addRow([
      c.employee.fullName,
      c.employee.employeeNumber,
      c.employee.position.name,
      c.certificationType.name,
      KIND_LABEL[c.certificationType.kind],
      c.certificateNumber ?? "-",
      c.issuer ?? "-",
      fmt(c.issuedDate.toISOString().slice(0, 10)),
      fmt(c.expiryDate ? c.expiryDate.toISOString().slice(0, 10) : null),
      CERTIFICATE_STATUS_LABEL[certificateStatus(c.expiryDate, c.certificationType.reminderDays, today)],
    ])
  }
  styleHeader(list)

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DOWNLOAD",
    entityType: "EmployeeCertification",
    description: `${user.username} mengunduh rekap kepatuhan sertifikasi & pelatihan wajib.`,
  })

  const buffer = await wb.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap Sertifikasi ${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
