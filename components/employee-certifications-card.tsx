import Link from "next/link"
import { Award, Paperclip } from "lucide-react"

import type { EmployeeCertificationSummary } from "@/lib/certification-compliance"
import { KIND_LABEL, daysUntil } from "@/lib/certification-status"
import { CertificateBadge, ComplianceBadge } from "@/components/certification-status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function formatDate(iso: string | null) {
  if (!iso) return "Selamanya"
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}

// Sertifikasi & pelatihan wajib milik satu pegawai — dipakai di detail pegawai
// (admin, dengan tautan kelola) dan Profil Saya (pegawai, hanya baca).
export function EmployeeCertificationsCard({
  summary,
  manageHref,
}: {
  summary: EmployeeCertificationSummary
  manageHref?: string
}) {
  const { certificates, requirements } = summary
  const pending = requirements.filter((r) => r.status !== "TERPENUHI")

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4" />
              Sertifikasi & Pelatihan
            </CardTitle>
            <CardDescription>
              {requirements.length === 0
                ? "Tidak ada sertifikasi wajib untuk jabatan ini."
                : pending.length === 0
                  ? `Semua ${requirements.length} kewajiban terpenuhi.`
                  : `${pending.length} dari ${requirements.length} kewajiban perlu ditindaklanjuti.`}
            </CardDescription>
          </div>
          {manageHref ? (
            <Link href={manageHref} className="shrink-0 text-xs font-medium text-primary hover:underline">
              Kelola
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {requirements.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Kewajiban</p>
            <ul className="divide-y rounded-md border">
              {requirements.map((r) => (
                <li key={r.typeName} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{r.typeName}</span>
                    <span className="text-xs text-muted-foreground">
                      {KIND_LABEL[r.kind]}
                      {r.status !== "BELUM_ADA" ? ` · berlaku s.d. ${formatDate(r.expiryDate)}` : ""}
                    </span>
                  </span>
                  <ComplianceBadge status={r.status} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Sertifikat Tercatat</p>
          {certificates.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Belum ada sertifikat yang dicatat HR.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {certificates.map((c) => {
                const left = daysUntil(c.expiryDate)
                return (
                  <li key={c.publicId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium">{c.typeName}</span>
                      <span className="text-xs text-muted-foreground">
                        {[c.certificateNumber, c.issuer].filter(Boolean).join(" · ")}
                        {c.certificateNumber || c.issuer ? " · " : ""}
                        {formatDate(c.issuedDate)} – {formatDate(c.expiryDate)}
                        {left !== null && left >= 0 && c.status === "SEGERA" ? ` (${left} hari lagi)` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {c.hasFile ? (
                        <a
                          href={`/api/sertifikasi/${c.publicId}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Paperclip className="size-3.5" />
                          File
                        </a>
                      ) : null}
                      <CertificateBadge status={c.status} />
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
