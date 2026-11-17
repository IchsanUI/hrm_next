import Link from "next/link"
import { redirect } from "next/navigation"
import { HeartPulse, Info, Plus } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { currentPlafonYear, getClaimEligibility, getHealthClaimSettings, getPlafonSummary } from "@/lib/health-claim"
import { formatClaimDate, formatRupiah, HEALTH_CLAIM_PATIENT_LABEL, plafonPeriodLabel } from "@/lib/health-claim-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HealthClaimPlafonCard, HealthClaimStatusBadge } from "@/components/health-claim-ui"

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export default async function PegawaiKlaimKesehatanPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string }>
}) {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/login")

  const { plafonStartMonth } = await getHealthClaimSettings()
  const currentYear = currentPlafonYear(plafonStartMonth)
  const { tahun } = await searchParams
  const year = Number(tahun) >= 2000 && Number(tahun) <= currentYear + 1 ? Number(tahun) : currentYear

  const [eligibility, claims, yearsRaw] = await Promise.all([
    getClaimEligibility(employeeId),
    prisma.healthClaim.findMany({
      where: { employeeId, plafonYear: year },
      select: {
        publicId: true,
        claimNumber: true,
        patientType: true,
        patientName: true,
        treatmentDate: true,
        facility: true,
        requestedAmount: true,
        approvedAmount: true,
        status: true,
        claimType: { select: { name: true } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.healthClaim.findMany({ where: { employeeId }, select: { plafonYear: true }, distinct: ["plafonYear"] }),
  ])
  const summary = eligibility.plafon !== null ? await getPlafonSummary(employeeId, year, eligibility.plafon) : null
  const years = [...new Set([currentYear, ...yearsRaw.map((y) => y.plafonYear)])].sort((a, b) => b - a)

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Klaim Kesehatan" }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <HeartPulse className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Klaim Kesehatan</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ajukan penggantian biaya berobat untuk Anda, suami/istri, dan anak yang terdaftar.
            </p>
          </div>
        </div>
        {eligibility.eligible ? (
          <Button render={<Link href="/pegawai/klaim-kesehatan/ajukan" />} nativeButton={false}>
            <Plus className="size-4" />
            Ajukan Klaim
          </Button>
        ) : null}
      </div>

      {!eligibility.eligible ? (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          {eligibility.reason}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {summary ? (
            <HealthClaimPlafonCard summary={summary} title={`Plafon klaim ${plafonPeriodLabel(year, plafonStartMonth)}`} />
          ) : null}
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">Ketentuan singkat</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Isi total biaya yang diklaim; rinciannya diperiksa petugas.</li>
              <li>Kuitansi/nota wajib dilampirkan, sebaiknya hasil scan atau foto yang terang dan utuh.</li>
              <li>Klaim yang melebihi sisa plafon dibayar sebesar sisa plafon.</li>
              <li>Klaim diajukan ke Direktur bersama klaim pegawai lain dalam satu Nota Dinas.</li>
            </ul>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm text-muted-foreground">Periode:</span>
            {years.map((y) => (
              <Link
                key={y}
                href={`/pegawai/klaim-kesehatan?tahun=${y}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  y === year ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {plafonPeriodLabel(y, plafonStartMonth)}
              </Link>
            ))}
          </div>

          <Card className="py-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">No. Klaim</th>
                    <th className="px-4 py-2.5 font-medium">Tgl Berobat</th>
                    <th className="px-4 py-2.5 font-medium">Jenis</th>
                    <th className="px-4 py-2.5 font-medium">Pasien</th>
                    <th className="px-4 py-2.5 font-medium">Fasilitas</th>
                    <th className="px-4 py-2.5 text-right font-medium">Diajukan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Disetujui</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                        Belum ada klaim untuk periode {plafonPeriodLabel(year, plafonStartMonth)}.
                      </td>
                    </tr>
                  ) : (
                    claims.map((c) => (
                      <tr key={c.publicId} className="border-t transition-colors hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                          <Link href={`/pegawai/klaim-kesehatan/${c.publicId}`} className="text-primary hover:underline">
                            {c.claimNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{formatClaimDate(iso(c.treatmentDate))}</td>
                        <td className="px-4 py-2.5">{c.claimType.name}</td>
                        <td className="px-4 py-2.5">
                          {c.patientType === "SELF" ? HEALTH_CLAIM_PATIENT_LABEL.SELF : c.patientName}
                        </td>
                        <td className="max-w-48 truncate px-4 py-2.5" title={c.facility}>
                          {c.facility}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatRupiah(c.requestedAmount)}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums whitespace-nowrap">
                          {c.approvedAmount === null ? <span className="text-muted-foreground">-</span> : formatRupiah(c.approvedAmount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <HealthClaimStatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
