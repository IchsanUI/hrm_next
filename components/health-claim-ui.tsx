import { cn } from "@/lib/utils"
import {
  HEALTH_CLAIM_STATUS_CLASS,
  HEALTH_CLAIM_STATUS_LABEL,
  formatRupiah,
  type HealthClaimStatusValue,
} from "@/lib/health-claim-labels"
import type { PlafonSummary } from "@/lib/health-claim"

export function HealthClaimStatusBadge({ status }: { status: HealthClaimStatusValue }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        HEALTH_CLAIM_STATUS_CLASS[status]
      )}
    >
      {HEALTH_CLAIM_STATUS_LABEL[status]}
    </span>
  )
}

// Kartu plafon tahunan: satu batang bertumpuk (terpakai | diproses | sisa)
// plus angka masing-masing. Warna hanya penanda segmen; angka tetap di tinta
// teks biasa.
export function HealthClaimPlafonCard({ summary, title }: { summary: PlafonSummary; title?: string }) {
  const { plafon, used, inProgress, remaining } = summary
  const pct = (v: number) => (plafon > 0 ? Math.min(100, (v / plafon) * 100) : 0)
  const over = used + inProgress > plafon

  const parts = [
    { label: "Terpakai", value: used, dot: "bg-primary", bar: "bg-primary" },
    { label: "Sedang diproses", value: inProgress, dot: "bg-amber-500", bar: "bg-amber-500" },
    { label: "Sisa", value: remaining, dot: "bg-muted-foreground/30", bar: "" },
  ]

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{title ?? `Plafon klaim ${summary.year}`}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatRupiah(remaining)}</p>
          <p className="text-xs text-muted-foreground">sisa dari {formatRupiah(plafon)}</p>
          <p className="text-xs text-muted-foreground">Dipakai bersama keluarga</p>
        </div>
      </div>
      <div
        className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Terpakai ${formatRupiah(used)}, sedang diproses ${formatRupiah(inProgress)}, sisa ${formatRupiah(remaining)}`}
      >
        {used > 0 ? <div className="h-full rounded-l-full bg-primary" style={{ width: `${pct(used)}%` }} /> : null}
        {inProgress > 0 ? <div className="h-full bg-amber-500" style={{ width: `${pct(inProgress)}%` }} /> : null}
      </div>
      <dl className="mt-4 grid gap-2 border-t pt-3 text-sm">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className={cn("size-2.5 shrink-0 rounded-full", p.dot)} />
              {p.label}
            </dt>
            <dd className="font-medium tabular-nums">{formatRupiah(p.value)}</dd>
          </div>
        ))}
      </dl>
      {over ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Total klaim melebihi plafon. Yang dapat dibayar paling banyak sebesar plafon yang tersisa.
        </p>
      ) : null}
    </div>
  )
}
