import Link from "next/link"

import { getTeamFeedPage } from "@/lib/team-feed"
import { formatFeedTime } from "@/lib/relative-time"
import { chartColor } from "@/lib/dashboard-palette"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Avatar warna hash per nama — pola sama seperti components/team-feed-card.tsx.
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase()
}

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return chartColor(hash)
}

// Cuplikan Ruang Tim buat dashboard pegawai — gantikan slot "Slip Gaji" yang
// tadinya cuma widget blueprint kalau belum ada slip terkunci. Server
// Component murni (read-only, tidak butuh interaktivitas) — gaya baris
// SENGAJA disamakan dengan components/team-feed-card.tsx (avatar besar,
// nama+waktu baris terpisah dari isi) supaya konsisten, cuma tanpa baris
// aksi (suka/komentar/simpan) karena ini cuma preview, bukan feed interaktif.
export async function TeamFeedPreviewCard({ employeeId }: { employeeId: number }) {
  const { rows } = await getTeamFeedPage(employeeId, null, 6)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Ruang Tim</CardTitle>
          <CardDescription>Kabar terbaru rekan satu departemen.</CardDescription>
        </div>
        <Link
          href="/pegawai/ruang-tim"
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Lihat semua
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada aktivitas di departemen ini.</p>
        ) : (
          <div>
            {rows.map((row) => (
              <div
                key={`${row.requestKind}-${row.requestId}`}
                className="flex items-start gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                {row.applicantPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto internal, tidak perlu optimisasi next/image
                  <img
                    src={row.applicantPhotoUrl}
                    alt={row.applicant}
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: avatarColor(row.applicant) }}
                  >
                    {initials(row.applicant)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                    <span className="font-semibold">{row.applicant}</span>
                    <span className="text-muted-foreground" suppressHydrationWarning>
                      · {formatFeedTime(row.occurredAt)}
                    </span>
                  </p>
                  <div className="mt-0.5 text-sm text-foreground">
                    {row.actionLabel ? (
                      <span className="text-muted-foreground">{row.actionLabel} </span>
                    ) : null}
                    {row.detail ? <span className="break-words">{row.detail}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
