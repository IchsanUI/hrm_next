"use client"

import { useState } from "react"

import type { SnapshotPoint } from "@/lib/storage-monitoring"

const MB = 1024 ** 2

function formatBytes(bytes: number) {
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / MB).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDay(date: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", opts)
}

// Batas atas sumbu Y "rapi" dalam MB (1, 2, 5, 10, 20, 50, ...).
function niceMaxMb(maxBytes: number) {
  const mb = Math.max(1, maxBytes / MB)
  const pow = 10 ** Math.floor(Math.log10(mb))
  for (const step of [1, 2, 5, 10]) {
    if (mb <= step * pow) return step * pow
  }
  return 10 * pow
}

// Column chart tren total penyimpanan per hari (database + file) — satu
// seri, satu warna aksen; rincian database vs file ada di tooltip.
export function StorageTrendChart({ points }: { points: SnapshotPoint[] }) {
  const [active, setActive] = useState<number | null>(null)

  if (points.length < 2) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
        <p className="text-sm font-medium">Tren mulai direkam</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Ukuran penyimpanan dicatat sekali per hari. Grafik muncul setelah ada minimal 2 hari data
          {points.length === 1 ? ` (data pertama: ${formatDay(points[0].date)})` : ""}.
        </p>
      </div>
    )
  }

  const totals = points.map((p) => p.databaseBytes + p.filesBytes)
  const yMaxMb = niceMaxMb(Math.max(...totals))
  const gridLines = [yMaxMb, yMaxMb / 2, 0]
  const first = totals[0]
  const last = totals[totals.length - 1]
  const growth = last - first
  const activePoint = active !== null ? points[active] : null

  return (
    <div>
      <p className="mb-6 text-xs text-muted-foreground">
        {formatDay(points[0].date)} – {formatDay(points[points.length - 1].date)}:{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {growth >= 0 ? "+" : "−"}
          {formatBytes(Math.abs(growth))}
        </span>{" "}
        ({first > 0 ? `${growth >= 0 ? "+" : "−"}${Math.abs((growth / first) * 100).toFixed(1)}%` : "-"})
      </p>

      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-2">
        <div className="relative h-40 text-[10px] tabular-nums text-muted-foreground">
          {gridLines.map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (v / yMaxMb) * 100}%` }}>
              {v} MB
            </span>
          ))}
        </div>

        <div className="relative h-40">
          {gridLines.map((v) => (
            <div
              key={v}
              className={v === 0 ? "absolute inset-x-0 border-t border-border" : "absolute inset-x-0 border-t border-dashed border-border/60"}
              style={{ top: `${100 - (v / yMaxMb) * 100}%` }}
            />
          ))}

          <div
            className="absolute inset-0 flex items-end"
            role="list"
            aria-label="Total penyimpanan per hari"
            onMouseLeave={() => setActive(null)}
          >
            {points.map((p, i) => {
              const height = Math.max(2, (totals[i] / MB / yMaxMb) * 100)
              return (
                <button
                  key={p.date}
                  type="button"
                  role="listitem"
                  className="group flex h-full flex-1 items-end justify-center px-[2px] focus-visible:outline-none"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${formatDay(p.date)}: ${formatBytes(totals[i])}`}
                >
                  <span
                    className="w-full max-w-5 rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-ring"
                    style={{
                      height: `${height}%`,
                      backgroundColor: "var(--chart-1)",
                      opacity: active !== null && active !== i ? 0.4 : 1,
                    }}
                  />
                </button>
              )
            })}
          </div>

          {activePoint && active !== null ? (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
              style={{ left: `${((active + 0.5) / points.length) * 100}%` }}
            >
              <p className="text-muted-foreground">
                {formatDay(activePoint.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
              </p>
              <p className="font-semibold tabular-nums">{formatBytes(totals[active])}</p>
              <p className="text-muted-foreground tabular-nums">
                Database {formatBytes(activePoint.databaseBytes)} · File {formatBytes(activePoint.filesBytes)}
              </p>
            </div>
          ) : null}
        </div>

        <div />
        <div className="mt-1.5 flex text-[10px] tabular-nums text-muted-foreground">
          {points.map((p, i) => {
            const step = Math.max(1, Math.ceil(points.length / 6))
            const show = i === 0 || i === points.length - 1 || (i % step === 0 && points.length - 1 - i >= step / 2)
            return (
              <span key={p.date} className="flex-1 text-center whitespace-nowrap">
                {show ? formatDay(p.date) : ""}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
