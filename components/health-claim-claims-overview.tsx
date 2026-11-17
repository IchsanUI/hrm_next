import Link from "next/link"
import { CheckCircle2, CircleAlert, FileSpreadsheet, FileText, HeartPulse, Paperclip, SlidersHorizontal } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getHealthClaimSettings, getMemoQueueStats } from "@/lib/health-claim"
import {
  HEALTH_CLAIM_STATUS_LABEL,
  IN_PROGRESS_STATUSES,
  formatClaimDate,
  formatRupiah,
  type HealthClaimStatusValue,
} from "@/lib/health-claim-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthClaimStatusBadge } from "@/components/health-claim-ui"

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const STATUS_FILTERS: (HealthClaimStatusValue | "SEMUA")[] = [
  "SEMUA",
  "MENUNGGU_KONFIRMASI",
  "REVISI",
  "TERKONFIRMASI",
  "DALAM_NOTA_DINAS",
  "DISETUJUI",
  "DIBAYAR",
  "DITOLAK",
  "DIBATALKAN",
]

// Daftar klaim + antrean Nota Dinas — dipakai halaman admin
// (/admin/payroll/klaim-kesehatan) dan menu Pemeriksaan Klaim petugas di
// portal pegawai (/pegawai/pemeriksaan-klaim). basePath menentukan ke mana
// tautan filter & nomor klaim mengarah.
export async function HealthClaimClaimsOverview({
  basePath,
  status,
  breadcrumbItems,
  title,
  description,
  settingsHref,
  showSetup,
  memoListHref,
  memoNewHref,
  rekapHref,
}: {
  basePath: string
  status: string | undefined
  breadcrumbItems: { label: string; href?: string }[]
  title: string
  description: string
  settingsHref?: string
  showSetup: boolean
  memoListHref?: string
  memoNewHref?: string
  rekapHref?: string
}) {
  const activeStatus = (STATUS_FILTERS as string[]).includes(status ?? "") ? (status as HealthClaimStatusValue | "SEMUA") : "SEMUA"

  const [claims, counts, petugasCount, accountingCount, plafonCount, positionsWithEmployees, eligibleCount, typeCount] =
    await Promise.all([
      prisma.healthClaim.findMany({
        where: activeStatus === "SEMUA" ? {} : { status: activeStatus },
        include: {
          employee: { select: { fullName: true, employeeNumber: true, position: { select: { name: true } } } },
          claimType: { select: { name: true } },
          _count: { select: { documents: true } },
          // Nota Dinas yang sedang/pernah memuat klaim ini (yang dibatalkan diabaikan).
          memoItems: {
            where: { memo: { status: { not: "DIBATALKAN" } } },
            select: { memo: { select: { memoNumber: true } } },
            orderBy: { id: "desc" },
            take: 1,
          },
        },
        orderBy: { submittedAt: "desc" },
        take: 200,
      }),
      prisma.healthClaim.groupBy({ by: ["status"], _count: { _all: true }, _sum: { requestedAmount: true } }),
      prisma.healthClaimStaff.count({ where: { role: "PETUGAS" } }),
      prisma.healthClaimStaff.count({ where: { role: "ACCOUNTING" } }),
      prisma.healthClaimPlafon.count(),
      prisma.position.count({ where: { employees: { some: { isDeleted: false, isActive: true } } } }),
      prisma.healthClaimEligibleStatus.count(),
      prisma.healthClaimType.count({ where: { isActive: true } }),
    ])

  const [settings, queue] = await Promise.all([getHealthClaimSettings(), getMemoQueueStats()])
  // Syarat minimal Nota Dinas dihitung per klaim.
  const queueReady = queue.claims >= settings.minEmployeesPerMemo
  const queuePct = Math.min(100, (queue.claims / settings.minEmployeesPerMemo) * 100)

  const countOf = (s: HealthClaimStatusValue) => counts.find((c) => c.status === s)?._count._all ?? 0
  const inProgress = counts
    .filter((c) => (IN_PROGRESS_STATUSES as string[]).includes(c.status))
    .reduce((sum, c) => sum + (c._sum.requestedAmount ?? 0), 0)

  const checklist = [
    { done: petugasCount > 0, label: "Petugas klaim ditunjuk", detail: `${petugasCount} orang` },
    { done: accountingCount > 0, label: "Accounting ditunjuk", detail: `${accountingCount} orang` },
    {
      done: plafonCount >= positionsWithEmployees && positionsWithEmployees > 0,
      label: "Plafon per jabatan diisi",
      detail: `${plafonCount} dari ${positionsWithEmployees} jabatan berpegawai`,
    },
    { done: eligibleCount > 0, label: "Status kepegawaian yang berhak dipilih", detail: `${eligibleCount} status` },
    { done: typeCount > 0, label: "Jenis klaim aktif", detail: `${typeCount} jenis` },
  ]
  const setupDone = checklist.every((c) => c.done)

  const stats = [
    { label: "Menunggu konfirmasi", value: String(countOf("MENUNGGU_KONFIRMASI")) },
    { label: "Perlu revisi pegawai", value: String(countOf("REVISI")) },
    { label: "Siap masuk Nota Dinas", value: String(countOf("TERKONFIRMASI")) },
    { label: "Nominal sedang diproses", value: formatRupiah(inProgress) },
  ]

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <HeartPulse className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {rekapHref ? (
            <Button variant="outline" render={<Link href={rekapHref} />} nativeButton={false}>
              <FileSpreadsheet className="size-4" />
              Rekap Plafon
            </Button>
          ) : null}
          {memoListHref ? (
            <Button variant="outline" render={<Link href={memoListHref} />} nativeButton={false}>
              <FileText className="size-4" />
              Daftar Nota Dinas
            </Button>
          ) : null}
          {settingsHref ? (
            <Button variant="outline" render={<Link href={settingsHref} />} nativeButton={false}>
              <SlidersHorizontal className="size-4" />
              Pengaturan
            </Button>
          ) : null}
        </div>
      </div>

      {showSetup && !setupDone ? (
        <Card className="mb-6">
          <CardHeader className="border-b">
            <CardTitle>Penyiapan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((c) => (
              <div key={c.label} className="flex items-start gap-2 text-sm">
                {c.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">{c.detail}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="py-0">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium">Antrean Nota Dinas</p>
            <p className="text-xs text-muted-foreground">
              {queue.claims} dari {settings.minEmployeesPerMemo} klaim · {queue.employees} pegawai · {formatRupiah(queue.amount)}
            </p>
            <div
              className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${queue.claims} dari ${settings.minEmployeesPerMemo} klaim`}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${queuePct}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {queueReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" />
                Syarat terpenuhi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                <CircleAlert className="size-3.5" />
                Butuh {settings.minEmployeesPerMemo - queue.claims} klaim lagi
              </span>
            )}
            {memoNewHref && queue.claims > 0 ? (
              <Button
                variant={queueReady ? "default" : "outline"}
                render={<Link href={memoNewHref} />}
                nativeButton={false}
              >
                <FileText className="size-4" />
                Buat Nota Dinas
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={`${basePath}?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              s === activeStatus ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {s === "SEMUA" ? "Semua" : HEALTH_CLAIM_STATUS_LABEL[s]}
            {s !== "SEMUA" && countOf(s) > 0 ? ` (${countOf(s)})` : ""}
          </Link>
        ))}
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">No. Klaim</th>
                <th className="px-4 py-2.5 font-medium">Pegawai</th>
                <th className="px-4 py-2.5 font-medium">Pasien</th>
                <th className="px-4 py-2.5 font-medium">Jenis</th>
                <th className="px-4 py-2.5 font-medium">Tgl Berobat</th>
                <th className="px-4 py-2.5 text-right font-medium">Diajukan</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada klaim{activeStatus !== "SEMUA" ? " dengan status ini" : ""}.
                  </td>
                </tr>
              ) : (
                claims.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                      <Link href={`${basePath}/${c.publicId}`} className="text-primary hover:underline">
                        {c.claimNumber}
                      </Link>
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground">
                        <Paperclip className="size-3" />
                        {c._count.documents}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.employee.fullName}
                      <span className="block text-xs text-muted-foreground">
                        {c.employee.employeeNumber} · {c.employee.position.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{c.patientType === "SELF" ? "Diri sendiri" : c.patientName}</td>
                    <td className="px-4 py-2.5">{c.claimType.name}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatClaimDate(iso(c.treatmentDate))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatRupiah(c.requestedAmount)}</td>
                    <td className="px-4 py-2.5">
                      <HealthClaimStatusBadge status={c.status} />
                      {c.memoItems[0] && c.status !== "TERKONFIRMASI" ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{c.memoItems[0].memo.memoNumber}</span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Klik nomor klaim untuk melihat detailnya. Pembayaran dicatat Accounting di menu Pembayaran Klaim.
      </p>
    </div>
  )
}
