"use client"

import { useState } from "react"

import type { FrequencyRow } from "@/lib/dashboard-stats"
import { chartColor } from "@/lib/dashboard-palette"

const OTHER_COLOR = "var(--muted-foreground)"
const MAX_SLICES = 4

export function DonutChart({
  rows,
  centerLabel = "Total Pengajuan",
  emptyMessage = "Belum ada data pada periode ini.",
}: {
  rows: FrequencyRow[]
  centerLabel?: string
  emptyMessage?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const total = rows.reduce((sum, r) => sum + r.count, 0)
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const sorted = [...rows].sort((a, b) => b.count - a.count)
  const top = sorted.slice(0, MAX_SLICES).filter((r) => r.count > 0)
  const restCount = sorted.slice(MAX_SLICES).reduce((sum, r) => sum + r.count, 0)
  const slices = [
    ...top.map((r, i) => ({ label: r.label, count: r.count, color: chartColor(i) })),
    ...(restCount > 0 ? [{ label: "Lainnya", count: restCount, color: OTHER_COLOR }] : []),
  ]

  let cursor = 0
  const stops = slices.map((s) => {
    const start = cursor
    const percent = (s.count / total) * 100
    cursor += percent
    return { ...s, start, end: cursor, percent }
  })

  const gradient = stops
    .map((s) => `${s.color} ${s.start}% ${s.end}%`)
    .join(", ")

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-start">
      <div
        className="relative size-[168px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-card text-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="px-2 text-[11px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      <div className="grid w-full max-w-[220px] gap-2">
        {stops.map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            title={`${s.label}: ${s.count}`}
            style={{ opacity: hovered === null || hovered === i ? 1 : 0.55 }}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {s.label}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {Math.round(s.percent)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
