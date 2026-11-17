import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Paperclip, RotateCcw } from "lucide-react"

import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/encryption"
import { getHealthClaimSettings } from "@/lib/health-claim"
import {
  HEALTH_CLAIM_EVENT_LABEL,
  HEALTH_CLAIM_PATIENT_LABEL,
  plafonPeriodLabel,
  HEALTH_CLAIM_STATUS_HINT,
  formatClaimDate,
  formatRupiah,
} from "@/lib/health-claim-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthClaimStatusBadge } from "@/components/health-claim-ui"
import { HealthClaimDocumentGallery } from "@/components/health-claim-document-gallery"
import { HealthClaimCancelButton } from "@/components/health-claim-cancel-button"

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

export default async function DetailKlaimKesehatanPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/login")

  const { publicId } = await params
  const { plafonStartMonth } = await getHealthClaimSettings()
  const claim = await prisma.healthClaim.findUnique({
    where: { publicId },
    include: {
      claimType: { select: { name: true } },
      items: { orderBy: { order: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  })
  // Pegawai hanya boleh melihat klaim miliknya sendiri.
  if (!claim || claim.employeeId !== employeeId) notFound()

  let diagnosis: string | null = null
  if (claim.diagnosis) {
    try {
      diagnosis = decryptField(claim.diagnosis)
    } catch {
      diagnosis = "(tidak dapat dibaca)"
    }
  }
  const canCancel = claim.status === "MENUNGGU_KONFIRMASI" || claim.status === "REVISI"
  const lastDecision = [...claim.events].reverse().find((e) => e.action === "REVISI" || e.action === "DITOLAK")
  const adjusted = claim.items.some((i) => i.approvedAmount !== null && i.approvedAmount !== i.amount)

  const fields: [string, string][] = [
    ["Jenis klaim", claim.claimType.name],
    [
      "Pasien",
      claim.patientType === "SELF" ? `${claim.patientName} (diri sendiri)` : `${claim.patientName} (${HEALTH_CLAIM_PATIENT_LABEL[claim.patientType]})`,
    ],
    [
      claim.dischargeDate ? "Tanggal dirawat" : "Tanggal berobat",
      claim.dischargeDate
        ? `${formatClaimDate(iso(claim.treatmentDate))} – ${formatClaimDate(iso(claim.dischargeDate))}`
        : formatClaimDate(iso(claim.treatmentDate)),
    ],
    ["Fasilitas kesehatan", claim.facility],
    ["Diagnosa / keluhan", diagnosis ?? "-"],
    ["Periode plafon", plafonPeriodLabel(claim.plafonYear, plafonStartMonth)],
  ]

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Klaim Kesehatan", href: "/pegawai/klaim-kesehatan" },
          { label: claim.claimNumber },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">{claim.claimNumber}</h1>
            <HealthClaimStatusBadge status={claim.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{HEALTH_CLAIM_STATUS_HINT[claim.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {claim.status === "REVISI" ? (
            <Button render={<Link href={`/pegawai/klaim-kesehatan/${claim.publicId}/perbaiki`} />} nativeButton={false}>
              <RotateCcw className="size-4" />
              Perbaiki Klaim
            </Button>
          ) : null}
          {canCancel ? <HealthClaimCancelButton publicId={claim.publicId} claimNumber={claim.claimNumber} /> : null}
        </div>
      </div>

      {lastDecision && (claim.status === "REVISI" || claim.status === "DITOLAK") ? (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            claim.status === "REVISI"
              ? "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
              : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          <span className="font-medium">
            {claim.status === "REVISI" ? "Yang perlu diperbaiki" : "Alasan penolakan"} ({lastDecision.actorName}):
          </span>{" "}
          {lastDecision.note}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                    {adjusted ? <th className="pb-2 text-right font-medium">Disetujui</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {claim.items.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="py-2">
                        {item.description}
                        {item.adjustmentNote ? (
                          <span className="block text-xs text-amber-700 dark:text-amber-400">
                            Catatan petugas: {item.adjustmentNote}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatRupiah(item.amount)}</td>
                      {adjusted ? (
                        <td className="py-2 text-right tabular-nums">{formatRupiah(item.approvedAmount ?? item.amount)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr className="border-t">
                    <td className="py-2 text-muted-foreground">Total biaya</td>
                    <td className="py-2 text-right tabular-nums" colSpan={adjusted ? 2 : 1}>
                      {formatRupiah(claim.totalCost)}
                    </td>
                  </tr>
                  {claim.bpjsCovered > 0 ? (
                    <tr>
                      <td className="py-1 text-muted-foreground">Ditanggung BPJS</td>
                      <td className="py-1 text-right tabular-nums" colSpan={adjusted ? 2 : 1}>
                        − {formatRupiah(claim.bpjsCovered)}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="border-t font-semibold">
                    <td className="py-2">Nominal diajukan</td>
                    <td className="py-2 text-right tabular-nums" colSpan={adjusted ? 2 : 1}>
                      {formatRupiah(claim.requestedAmount)}
                    </td>
                  </tr>
                  {claim.approvedAmount !== null ? (
                    <tr className="font-semibold text-emerald-700 dark:text-emerald-400">
                      <td className="py-1">Nominal disetujui</td>
                      <td className="py-1 text-right tabular-nums" colSpan={adjusted ? 2 : 1}>
                        {formatRupiah(claim.approvedAmount)}
                      </td>
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {claim.payment ? (
            <Card className="border-emerald-300 dark:border-emerald-800">
              <CardContent className="grid gap-1 text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">
                  Sudah dibayar {formatRupiah(claim.payment.amount)}
                </p>
                <p className="text-muted-foreground">
                  {claim.payment.method === "TRANSFER"
                    ? `Transfer ke ${claim.payment.bankName ?? ""} ${claim.payment.bankAccountNumber ?? ""}`
                    : "Tunai lewat teller"}{" "}
                  · {formatClaimDate(iso(claim.payment.paidDate))}
                </p>
              </CardContent>
            </Card>
          ) : claim.status === "DISETUJUI" ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">
                Klaim sudah disetujui Direksi dan sedang menunggu ditransfer oleh Accounting ke rekening Anda.
              </CardContent>
            </Card>
          ) : null}
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
        </div>
      </div>
    </div>
  )
}
