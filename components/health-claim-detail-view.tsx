import Link from "next/link"
import { Info, Paperclip } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/encryption"
import {
  canReviewHealthClaims,
  getClaimEligibility,
  getHealthClaimSettings,
  getPlafonSummary,
  getRemainingForConfirmation,
} from "@/lib/health-claim"
import {
  HEALTH_CLAIM_EVENT_LABEL,
  HEALTH_CLAIM_PATIENT_LABEL,
  plafonPeriodLabel,
  formatClaimDate,
  formatRupiah,
} from "@/lib/health-claim-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthClaimPlafonCard, HealthClaimStatusBadge } from "@/components/health-claim-ui"
import { HealthClaimDocumentGallery } from "@/components/health-claim-document-gallery"
import { HealthClaimReviewPanel } from "@/components/health-claim-review-panel"

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

function formatDateTime(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })
}

type Viewer = { role: string; employeeId?: number | null }

// Detail & pemeriksaan satu klaim — dipakai halaman admin dan menu
// Pemeriksaan Klaim petugas. Mengembalikan null bila klaim tidak ada.
export async function HealthClaimDetailView({
  publicId,
  basePath,
  breadcrumbItems,
  viewer,
  employeeHref,
}: {
  publicId: string
  basePath: string
  breadcrumbItems: { label: string; href?: string }[]
  viewer: Viewer
  employeeHref?: (employeePublicId: string) => string
}) {
  const user = viewer
  const claim = await prisma.healthClaim.findUnique({
    where: { publicId },
    include: {
      claimType: { select: { name: true, requiredDocumentLabel: true } },
      items: { orderBy: { order: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      employee: {
        select: {
          fullName: true,
          employeeNumber: true,
          publicId: true,
          position: { select: { name: true } },
          department: { select: { name: true } },
          employmentStatus: { select: { name: true } },
        },
      },
    },
  })
  if (!claim) return null

  const { plafonStartMonth } = await getHealthClaimSettings()
  const [isReviewer, eligibility, otherClaims] = await Promise.all([
    canReviewHealthClaims(user),
    getClaimEligibility(claim.employeeId),
    prisma.healthClaim.findMany({
      where: { employeeId: claim.employeeId, plafonYear: claim.plafonYear, id: { not: claim.id } },
      select: {
        publicId: true,
        claimNumber: true,
        status: true,
        requestedAmount: true,
        approvedAmount: true,
        treatmentDate: true,
        claimType: { select: { name: true } },
      },
      orderBy: { submittedAt: "desc" },
    }),
  ])
  const plafon = eligibility.plafon ?? 0
  const [summary, remainingForThis] = await Promise.all([
    getPlafonSummary(claim.employeeId, claim.plafonYear, plafon),
    getRemainingForConfirmation(claim, plafon),
  ])

  let diagnosis: string | null = null
  if (claim.diagnosis) {
    try {
      diagnosis = decryptField(claim.diagnosis)
    } catch {
      diagnosis = "(tidak dapat dibaca)"
    }
  }

  const isOwnClaim = claim.employeeId === user.employeeId
  const canAct = isReviewer && claim.status === "MENUNGGU_KONFIRMASI" && !isOwnClaim

  const fields: [string, string][] = [
    ["Jenis klaim", claim.claimType.name],
    [
      "Pasien",
      claim.patientType === "SELF"
        ? `${claim.patientName} (diri sendiri)`
        : `${claim.patientName} (${HEALTH_CLAIM_PATIENT_LABEL[claim.patientType]})`,
    ],
    [
      claim.dischargeDate ? "Tanggal dirawat" : "Tanggal berobat",
      claim.dischargeDate
        ? `${formatClaimDate(iso(claim.treatmentDate))} – ${formatClaimDate(iso(claim.dischargeDate))}`
        : formatClaimDate(iso(claim.treatmentDate)),
    ],
    ["Fasilitas kesehatan", claim.facility],
    ["Diagnosa / keluhan", diagnosis ?? "-"],
    ["Diajukan", formatDateTime(claim.submittedAt)],
  ]

  return (
    <div>
      <Breadcrumb items={[...breadcrumbItems, { label: claim.claimNumber }]} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">{claim.claimNumber}</h1>
        <HealthClaimStatusBadge status={claim.status} />
      </div>

      {claim.status === "MENUNGGU_KONFIRMASI" && !canAct ? (
        <div className="mb-6 flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {isOwnClaim
            ? "Ini klaim milik Anda sendiri, sehingga harus dikonfirmasi petugas lain."
            : "Hanya petugas klaim yang ditunjuk di Pengaturan Klaim Kesehatan yang bisa mengonfirmasi klaim ini, lewat menu Pemeriksaan Klaim."}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Informasi Klaim</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 pt-2 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium break-words">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {canAct ? (
            <HealthClaimReviewPanel
              publicId={claim.publicId}
              claimNumber={claim.claimNumber}
              items={claim.items.map((i) => ({ id: i.id, description: i.description, amount: i.amount }))}
              bpjsCovered={claim.bpjsCovered}
              requestedAmount={claim.requestedAmount}
              remainingPlafon={remainingForThis}
            />
          ) : (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Rincian Biaya</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Uraian</th>
                      <th className="pb-2 text-right font-medium">Diajukan</th>
                      <th className="pb-2 text-right font-medium">Disetujui</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claim.items.map((item) => (
                      <tr key={item.id} className="border-t align-top">
                        <td className="py-2">
                          {item.description}
                          {item.adjustmentNote ? (
                            <span className="block text-xs text-amber-700 dark:text-amber-400">{item.adjustmentNote}</span>
                          ) : null}
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatRupiah(item.amount)}</td>
                        <td className="py-2 text-right tabular-nums">
                          {item.approvedAmount === null ? "-" : formatRupiah(item.approvedAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="mt-3 grid gap-1 border-t pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total biaya</dt>
                    <dd className="tabular-nums">{formatRupiah(claim.totalCost)}</dd>
                  </div>
                  {claim.bpjsCovered > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Ditanggung BPJS</dt>
                      <dd className="tabular-nums">− {formatRupiah(claim.bpjsCovered)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-medium">
                    <dt>Nominal diajukan</dt>
                    <dd className="tabular-nums">{formatRupiah(claim.requestedAmount)}</dd>
                  </div>
                  {claim.approvedAmount !== null ? (
                    <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-400">
                      <dt>Nominal disetujui</dt>
                      <dd className="tabular-nums">{formatRupiah(claim.approvedAmount)}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Riwayat</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <ol className="relative grid gap-4 border-l pl-4">
                {claim.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-primary" />
                    <p className="font-medium">{HEALTH_CLAIM_EVENT_LABEL[e.action] ?? e.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.actorName} · {formatDateTime(e.createdAt)}
                    </p>
                    {e.note ? <p className="mt-1 text-xs">{e.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardContent className="grid gap-1 text-sm">
              <p className="text-xs text-muted-foreground">Pegawai</p>
              {employeeHref ? (
                <Link href={employeeHref(claim.employee.publicId)} className="font-semibold text-primary hover:underline">
                  {claim.employee.fullName}
                </Link>
              ) : (
                <p className="font-semibold">{claim.employee.fullName}</p>
              )}
              <p className="text-muted-foreground">
                {claim.employee.employeeNumber} · {claim.employee.position.name}
              </p>
              <p className="text-muted-foreground">
                {claim.employee.department.name} · {claim.employee.employmentStatus.name}
              </p>
            </CardContent>
          </Card>

          {eligibility.plafon !== null ? (
            <HealthClaimPlafonCard
              summary={summary}
              title={`Plafon pegawai ${plafonPeriodLabel(claim.plafonYear, plafonStartMonth)}`}
            />
          ) : (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Plafon jabatan {claim.employee.position.name} belum diatur.
            </p>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="size-4" />
                Bukti
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <HealthClaimDocumentGallery
                documents={claim.documents.map((d) => ({
                  publicId: d.publicId,
                  originalName: d.originalName,
                  isPdf: d.storedFileName.endsWith(".pdf"),
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Klaim lain periode {plafonPeriodLabel(claim.plafonYear, plafonStartMonth)}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {otherClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada.</p>
              ) : (
                <ul className="grid gap-2">
                  {otherClaims.map((c) => (
                    <li key={c.publicId}>
                      <Link
                        href={`${basePath}/${c.publicId}`}
                        className="flex items-center justify-between gap-2 text-sm hover:underline"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{c.claimType.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.claimNumber} · {formatClaimDate(iso(c.treatmentDate))}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block tabular-nums">{formatRupiah(c.approvedAmount ?? c.requestedAmount)}</span>
                          <HealthClaimStatusBadge status={c.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
