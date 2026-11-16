"use client"

import { useState } from "react"

import type { HourBucket } from "@/lib/system-monitoring"

const HOUR_MS = 3_600_000

function hourLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

// Batas atas sumbu Y yang "rapi" (1, 2, 5, 10, 20, 50, ...) supaya garis
// bantu punya angka bulat.
function niceMax(value: number) {
  if (value <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * pow) return step * pow
  }
  return 10 * pow
}

// Column chart 24 jam — satu seri (jumlah aktivitas per jam), satu warna
// aksen, kolom tipis dengan jarak antar-kolom. Jam tanpa aktivitas tetap
// digambar sebagai stub tipis supaya struktur 24 slot terbaca. Detail per
// jam lewat tooltip saat hover/fokus.
export function HourlyActivityChart({ buckets }: { buckets: HourBucket[] }) {
  const [active, setActive] = useState<number | null>(null)
  const peak = Math.max(0, ...buckets.map((b) => b.count))
  const yMax = niceMax(peak)
  const gridLines = [yMax, yMax / 2, 0]
  const activeBucket = active !== null ? buckets[active] : null

  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
      {/* Sumbu Y */}
      <div className="relative h-40 text-[10px] tabular-nums text-muted-foreground">
        {gridLines.map((value) => (
          <span
            key={value}
            className="absolute right-0 -translate-y-1/2"
            style={{ top: `${100 - (value / yMax) * 100}%` }}
          >
            {value}
          </span>
        ))}
      </div>

      {/* Area plot */}
      <div className="relative h-40">
        {gridLines.map((value) => (
          <div
            key={value}
            className={value === 0 ? "absolute inset-x-0 border-t border-border" : "absolute inset-x-0 border-t border-dashed border-border/60"}
            style={{ top: `${100 - (value / yMax) * 100}%` }}
          />
        ))}

        <div
          className="absolute inset-0 flex items-end"
          role="list"
          aria-label="Aktivitas per jam, 24 jam terakhir"
          onMouseLeave={() => setActive(null)}
        >
          {buckets.map((bucket, i) => {
            const height = bucket.count === 0 ? 0 : Math.max(3, (bucket.count / yMax) * 100)
            const dimmed = active !== null && active !== i
            return (
              <button
                key={bucket.hourStart}
                type="button"
                role="listitem"
                className="group flex h-full flex-1 items-end justify-center px-[2px] focus-visible:outline-none"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${hourLabel(bucket.hourStart)}: ${bucket.count} aktivitas`}
              >
                {bucket.count === 0 ? (
                  <span className="h-[2px] w-full max-w-4 rounded-full bg-muted-foreground/20" />
                ) : (
                  <span
                    className="w-full max-w-4 rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-ring"
                    style={{
                      height: `${height}%`,
                      backgroundColor: "var(--chart-1)",
                      opacity: dimmed ? 0.4 : 1,
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Tooltip — melayang di atas kolom yang di-hover */}
        {activeBucket && active !== null ? (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            style={{ left: `${((active + 0.5) / buckets.length) * 100}%` }}
          >
            <p className="text-muted-foreground">
              {hourLabel(activeBucket.hourStart)}–
              {hourLabel(new Date(new Date(activeBucket.hourStart).getTime() + HOUR_MS).toISOString())}
            </p>
            <p className="font-semibold tabular-nums">{activeBucket.count} aktivitas</p>
            {activeBucket.failed > 0 ? (
              <p className="text-muted-foreground tabular-nums">{activeBucket.failed} login gagal</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Sumbu X */}
      <div />
      <div className="mt-1.5 flex text-[10px] tabular-nums text-muted-foreground">
        {buckets.map((bucket, i) => (
          <span key={bucket.hourStart} className="flex-1 text-center">
            {i === buckets.length - 1 ? "Kini" : i % 6 === 0 ? hourLabel(bucket.hourStart) : ""}
          </span>
        ))}
      </div>
    </div>
  )
}
