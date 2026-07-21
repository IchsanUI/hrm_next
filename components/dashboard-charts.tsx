"use client"

import { useState } from "react"

import type { FrequencyRow } from "@/lib/dashboard-stats"
import { chartColor } from "@/lib/dashboard-palette"

// Bar chart magnitude (ranking), rounded data-end, value langsung dilabel
// di ujung bar. `variant="categorical"` mewarnai tiap baris beda (urutan
// tetap, lihat lib/dashboard-palette.ts) — dipakai saat jenis kategorinya
// sendiri yang jadi daya tarik visual (mis. jenis izin). `variant="single"`
// pakai satu warna (`accentColor`) — buat ranking yang lebih sederhana.
export function HorizontalBarChart({
  rows,
  variant = "single",
  accentColor = "var(--chart-1)",
  emptyMessage = "Belum ada data pada periode ini.",
}: {
  rows: FrequencyRow[]
  variant?: "categorical" | "single"
  accentColor?: string
  emptyMessage?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.count))

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="grid gap-2">
      {rows.map((row, i) => {
        const percent = Math.round((row.count / max) * 100)
        const color = variant === "categorical" ? chartColor(i) : accentColor
        return (
          <div
            key={row.label}
            className="grid grid-cols-[7.5rem_minmax(0,1fr)_2ch] items-center gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60 sm:grid-cols-[9rem_minmax(0,1fr)_2ch]"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            title={`${row.label}: ${row.count}`}
          >
            <span className="truncate text-xs text-muted-foreground">{row.label}</span>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${percent}%`,
                  backgroundColor: color,
                  opacity: hovered === null || hovered === i ? 1 : 0.55,
                }}
              />
            </div>
            <span className="text-right text-sm font-semibold tabular-nums">{row.count}</span>
          </div>
        )
      })}
    </div>
  )
}

// Column chart 6 bulan — satu hue (accent per kartu, biar tiap panel
// dashboard punya warna sendiri), cap rounded di ujung atas, value di atas
// kolom. Dipakai buat tren jumlah pengajuan izin bulanan.
export function MonthlyColumnChart({
  rows,
  accentColor = "var(--chart-6)",
}: {
  rows: FrequencyRow[]
  accentColor?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className="flex items-end gap-3 sm:gap-4" style={{ height: 160 }}>
      {rows.map((row, i) => {
        const heightPercent = Math.max(4, Math.round((row.count / max) * 100))
        const isHovered = hovered === i
        return (
          <div
            key={row.label}
            className="flex flex-1 flex-col items-center justify-end gap-1.5"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            title={`${row.label}: ${row.count} pengajuan`}
          >
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {row.count}
            </span>
            <div className="flex h-[110px] w-full items-end">
              <div
                className="w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: accentColor,
                  opacity: hovered === null || isHovered ? 1 : 0.55,
                }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">{row.label}</span>
          </div>
        )
      })}
    </div>
  )
}
