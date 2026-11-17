import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { canViewHealthClaimReports, getHealthClaimSettings, getPlafonRecap } from "@/lib/health-claim"
import {
  HEALTH_CLAIM_PATIENT_LABEL,
  HEALTH_CLAIM_STATUS_LABEL,
  plafonPeriodLabel,
  plafonPeriodYear,
} from "@/lib/health-claim-labels"
import { signWorkbook } from "@/lib/app-signature"

// Laporan Klaim Kesehatan bulanan (?bulan=2026-11):
//   1. Ringkasan per pegawai — klaim diajukan & dibayar di bulan itu, plus
//      posisi plafon tahunan saat ini.
//   2. Rincian klaim yang DIAJUKAN di bulan itu.
//   3. Pembayaran yang DICATAT di bulan itu (dasar penerimaan bulan berjalan).

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

function resolveMonth(bulan: string | null) {
  const now = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })}T00:00:00Z`)
  const [y, m] = (bulan ?? "").split("-").map(Number)
  const year = y >= 2000 && y <= 2100 ? y : now.getUTCFullYear()
  const month = m >= 1 && m <= 12 ? m - 1 : now.getUTCMonth()
  // Waktu pengajuan disimpan UTC; batas bulan dihitung dalam WIB (UTC+7).
  const start = new Date(Date.UTC(year, month, 1) - 7 * 3_600_000)
  const end = new Date(Date.UTC(year, month + 1, 1) - 7 * 3_600_000)
  // Kolom tanggal (@db.Date) dibandingkan langsung dalam UTC.
  const dateStart = new Date(Date.UTC(year, month, 1))
  const dateEnd = new Date(Date.UTC(year, month + 1, 1))
  return { year, month, start, end, dateStart, dateEnd, label: `${MONTHS[month]} ${year}` }
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } }
    cell.border = { bottom: { style: "thin" } }
  })
}

export async function GET(request: Request) {
  const session = await auth()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await canViewHealthClaimReports(user))) return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 })

  const range = resolveMonth(new URL(request.url).searchParams.get("bulan"))
  const { plafonStartMonth } = await getHealthClaimSettings()
  const periodYear = plafonPeriodYear(range.year, range.month, plafonStartMonth)
  const periodLabel = plafonPeriodLabel(periodYear, plafonStartMonth)

  const [claims, payments, recap] = await Promise.all([
    prisma.healthClaim.findMany({
      where: { submittedAt: { gte: range.start, lt: range.end } },
      orderBy: { submittedAt: "asc" },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, position: { select: { name: true } } } },
        claimType: { select: { name: true } },
        payment: { select: { paidDate: true } },
        memoItems: {
          where: { memo: { status: { not: "DIBATALKAN" } } },
          select: { memo: { select: { memoNumber: true } } },
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    }),
    prisma.healthClaimPayment.findMany({
      where: { paidDate: { gte: range.dateStart, lt: range.dateEnd } },
      orderBy: { paidDate: "asc" },
      include: {
        memo: { select: { memoNumber: true } },
        claim: {
          select: {
            claimNumber: true,
            patientName: true,
            employee: { select: { id: true, fullName: true, employeeNumber: true } },
            claimType: { select: { name: true } },
          },
        },
      },
    }),
    getPlafonRecap(periodYear),
  ])

  // ── Sheet 1: ringkasan per pegawai ─────────────────────────
  type Agg = { submitted: number; requested: number; approved: number; paid: number; paidCount: number }
  const agg = new Map<number, Agg>()
  const get = (id: number) => agg.get(id) ?? { submitted: 0, requested: 0, approved: 0, paid: 0, paidCount: 0 }
  for (const c of claims) {
    const a = get(c.employee.id)
    a.submitted += 1
    a.requested += c.requestedAmount
    a.approved += c.approvedAmount ?? 0
    agg.set(c.employee.id, a)
  }
  for (const p of payments) {
    const a = get(p.claim.employee.id)
    a.paid += p.amount
    a.paidCount += 1
    agg.set(p.claim.employee.id, a)
  }
  const recapById = new Map(recap.map((r) => [r.employeeId, r]))

  const workbook = new ExcelJS.Workbook()
  signWorkbook(workbook)

  const s1 = workbook.addWorksheet("Ringkasan per Pegawai")
  s1.addRow([`REKAP KLAIM KESEHATAN — ${range.label.toUpperCase()}`]).font = { bold: true, size: 13 }
  s1.addRow([`Plafon & sisa: periode ${periodLabel}, posisi saat laporan diunduh.`]).font = { italic: true, size: 9 }
  s1.addRow([])
  const h1 = s1.addRow([
    "NIP",
    "Nama",
    "Jabatan",
    "Klaim Diajukan",
    "Nominal Diajukan",
    "Nominal Disetujui",
    "Klaim Dibayar",
    "Nominal Dibayar",
    `Plafon ${periodLabel}`,
    "Terpakai",
    "Diproses",
    "Sisa Plafon",
  ])
  styleHeader(h1)
  const ids = [...agg.keys()]
  const rows = ids
    .map((id) => ({ id, a: agg.get(id)!, r: recapById.get(id) }))
    .sort((x, y) => (x.r?.fullName ?? "").localeCompare(y.r?.fullName ?? ""))
  const nameOf = (id: number) =>
    claims.find((c) => c.employee.id === id)?.employee ?? payments.find((p) => p.claim.employee.id === id)?.claim.employee
  for (const { id, a, r } of rows) {
    const e = nameOf(id)
    s1.addRow([
      r?.employeeNumber ?? e?.employeeNumber ?? "",
      r?.fullName ?? e?.fullName ?? "",
      r?.position ?? "",
      a.submitted,
      a.requested,
      a.approved,
      a.paidCount,
      a.paid,
      r?.plafon ?? "Belum diatur",
      r?.used ?? 0,
      r?.inProgress ?? 0,
      r?.remaining ?? "",
    ])
  }
  const sum = (k: keyof Agg) => rows.reduce((s, x) => s + x.a[k], 0)
  const t1 = s1.addRow(["", "TOTAL", "", sum("submitted"), sum("requested"), sum("approved"), sum("paidCount"), sum("paid")])
  t1.font = { bold: true }
  ;[14, 28, 24, 14, 16, 16, 13, 16, 16, 14, 14, 14].forEach((w, i) => (s1.getColumn(i + 1).width = w))
  for (const c of [5, 6, 8, 9, 10, 11, 12]) s1.getColumn(c).numFmt = "#,##0"

  // ── Sheet 2: rincian klaim diajukan ────────────────────────
  const s2 = workbook.addWorksheet("Klaim Diajukan")
  const h2 = s2.addRow([
    "No. Klaim",
    "Tgl Pengajuan",
    "Tgl Berobat",
    "NIP",
    "Pegawai",
    "Pasien",
    "Jenis",
    "Fasilitas",
    "Diajukan",
    "Disetujui",
    "Status",
    "Nota Dinas",
    "Tgl Bayar",
  ])
  styleHeader(h2)
  for (const c of claims) {
    s2.addRow([
      c.claimNumber,
      c.submittedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
      c.treatmentDate.toISOString().slice(0, 10),
      c.employee.employeeNumber,
      c.employee.fullName,
      c.patientType === "SELF" ? c.patientName : `${c.patientName} (${HEALTH_CLAIM_PATIENT_LABEL[c.patientType]})`,
      c.claimType.name,
      c.facility,
      c.requestedAmount,
      c.approvedAmount ?? "",
      HEALTH_CLAIM_STATUS_LABEL[c.status],
      c.memoItems[0]?.memo.memoNumber ?? "",
      c.payment ? c.payment.paidDate.toISOString().slice(0, 10) : "",
    ])
  }
  ;[16, 13, 13, 14, 26, 26, 18, 24, 14, 14, 20, 18, 13].forEach((w, i) => (s2.getColumn(i + 1).width = w))
  for (const c of [9, 10]) s2.getColumn(c).numFmt = "#,##0"

  // ── Sheet 3: pembayaran dicatat ────────────────────────────
  const s3 = workbook.addWorksheet("Pembayaran")
  const h3 = s3.addRow(["Tgl Bayar", "No. Klaim", "NIP", "Pegawai", "Pasien", "Jenis", "Nominal", "Metode", "No. Jurnal CBS", "Nota Dinas"])
  styleHeader(h3)
  for (const p of payments) {
    s3.addRow([
      p.paidDate.toISOString().slice(0, 10),
      p.claim.claimNumber,
      p.claim.employee.employeeNumber,
      p.claim.employee.fullName,
      p.claim.patientName,
      p.claim.claimType.name,
      p.amount,
      p.method === "TRANSFER" ? "Transfer" : "Tunai/Teller",
      p.reference ?? "",
      p.memo.memoNumber,
    ])
  }
  const t3 = s3.addRow(["", "", "", "TOTAL", "", "", payments.reduce((s, p) => s + p.amount, 0)])
  t3.font = { bold: true }
  ;[13, 16, 14, 26, 24, 18, 14, 14, 18, 18].forEach((w, i) => (s3.getColumn(i + 1).width = w))
  s3.getColumn(7).numFmt = "#,##0"

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${user.username} mengunduh laporan Rekap Klaim Kesehatan (${range.label}).`,
  })
  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap Klaim Kesehatan ${range.label}.xlsx"`,
      "Cache-Control": "no-store, private",
    },
  })
}
