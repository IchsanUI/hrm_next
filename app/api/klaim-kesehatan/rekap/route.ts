import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { canViewHealthClaimReports, currentPlafonYear, getHealthClaimSettings, getPlafonRecap } from "@/lib/health-claim"
import {
  DISPOSITION_LABEL,
  HEALTH_CLAIM_STATUS_LABEL,
  HEALTH_CLAIM_PATIENT_LABEL,
  plafonPeriodLabel,
  plafonPeriodYearOfIso,
} from "@/lib/health-claim-labels"
import { signWorkbook } from "@/lib/app-signature"

// Rekap Plafon klaim kesehatan per pegawai per tahun (sheet 1) + rincian
// semua klaim tahun tersebut (sheet 2). ?tahun=2026
export async function GET(request: Request) {
  const session = await auth()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await canViewHealthClaimReports(user))) return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 })

  const { plafonStartMonth } = await getHealthClaimSettings()
  const currentYear = currentPlafonYear(plafonStartMonth)
  // ?tahun=2026 (periode plafon), atau ?bulan=2026-11 dari dialog pilih bulan
  // di menu Laporan → periode yang memuat bulan tersebut.
  const params = new URL(request.url).searchParams
  const bulan = params.get("bulan")
  const raw = bulan && /^\d{4}-\d{2}$/.test(bulan) ? plafonPeriodYearOfIso(`${bulan}-01`, plafonStartMonth) : Number(params.get("tahun"))
  const year = raw >= 2000 && raw <= currentYear + 1 ? raw : currentYear
  const periodLabel = plafonPeriodLabel(year, plafonStartMonth)

  const [recap, claims] = await Promise.all([
    getPlafonRecap(year),
    prisma.healthClaim.findMany({
      where: { plafonYear: year },
      orderBy: { submittedAt: "asc" },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
        claimType: { select: { name: true } },
        payment: { select: { paidDate: true, method: true } },
        memoItems: {
          where: { memo: { status: { not: "DIBATALKAN" } } },
          select: { memo: { select: { memoNumber: true, steps: { where: { type: "DISPOSISI_DIREKTUR", decision: { not: null } }, select: { decision: true, note: true } } } } },
        },
      },
    }),
  ])

  const workbook = new ExcelJS.Workbook()
  signWorkbook(workbook)

  const s1 = workbook.addWorksheet("Rekap Plafon")
  s1.columns = [
    { header: "NIP", key: "nip", width: 14 },
    { header: "Nama", key: "name", width: 28 },
    { header: "Jabatan", key: "position", width: 26 },
    { header: "Status", key: "status", width: 14 },
    { header: "Plafon", key: "plafon", width: 14 },
    { header: "Terpakai", key: "used", width: 14 },
    { header: "Diproses", key: "inProgress", width: 14 },
    { header: "Sisa", key: "remaining", width: 14 },
    { header: "Jml Klaim", key: "count", width: 10 },
  ]
  s1.getRow(1).font = { bold: true }
  for (const r of recap) {
    s1.addRow({
      nip: r.employeeNumber,
      name: r.fullName + (r.isActive ? "" : " (nonaktif)"),
      position: r.position,
      status: r.employmentStatus,
      plafon: r.plafon ?? "Belum diatur",
      used: r.used,
      inProgress: r.inProgress,
      remaining: r.remaining ?? "",
      count: r.claimCount,
    })
  }
  const totals = s1.addRow({
    name: "TOTAL",
    used: recap.reduce((s, r) => s + r.used, 0),
    inProgress: recap.reduce((s, r) => s + r.inProgress, 0),
    count: recap.reduce((s, r) => s + r.claimCount, 0),
  })
  totals.font = { bold: true }
  for (const key of ["plafon", "used", "inProgress", "remaining"]) s1.getColumn(key).numFmt = "#,##0"

  const s2 = workbook.addWorksheet("Rincian Klaim")
  s2.columns = [
    { header: "No. Klaim", key: "no", width: 16 },
    { header: "NIP", key: "nip", width: 14 },
    { header: "Pegawai", key: "name", width: 26 },
    { header: "Pasien", key: "patient", width: 26 },
    { header: "Jenis", key: "type", width: 18 },
    { header: "Tgl Berobat", key: "date", width: 13 },
    { header: "Diajukan", key: "requested", width: 14 },
    { header: "Disetujui", key: "approved", width: 14 },
    { header: "Status", key: "status", width: 18 },
    { header: "Nota Dinas", key: "memo", width: 18 },
    { header: "Disposisi", key: "disposition", width: 30 },
    { header: "Tgl Bayar", key: "paid", width: 13 },
    { header: "Metode", key: "method", width: 12 },
  ]
  s2.getRow(1).font = { bold: true }
  for (const c of claims) {
    const memo = c.memoItems[c.memoItems.length - 1]?.memo
    const dispo = memo?.steps[0]
    s2.addRow({
      no: c.claimNumber,
      nip: c.employee.employeeNumber,
      name: c.employee.fullName,
      patient: c.patientType === "SELF" ? c.patientName : `${c.patientName} (${HEALTH_CLAIM_PATIENT_LABEL[c.patientType]})`,
      type: c.claimType.name,
      date: c.treatmentDate.toISOString().slice(0, 10),
      requested: c.requestedAmount,
      approved: c.approvedAmount ?? "",
      status: HEALTH_CLAIM_STATUS_LABEL[c.status],
      memo: memo?.memoNumber ?? "",
      disposition: dispo?.decision ? `${DISPOSITION_LABEL[dispo.decision]}${dispo.note ? `: ${dispo.note}` : ""}` : "",
      paid: c.payment ? c.payment.paidDate.toISOString().slice(0, 10) : "",
      method: c.payment ? (c.payment.method === "TRANSFER" ? "Transfer" : "Tunai") : "",
    })
  }
  for (const key of ["requested", "approved"]) s2.getColumn(key).numFmt = "#,##0"

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DOWNLOAD",
    entityType: "HealthClaim",
    description: `${user.username} mengunduh rekap plafon klaim kesehatan periode ${periodLabel}.`,
  })
  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap Plafon Klaim Kesehatan ${periodLabel.replace(/\s/g, " ")}.xlsx"`,
      "Cache-Control": "no-store, private",
    },
  })
}
