"use client"

import Link from "next/link"
import { useState } from "react"

import { cn } from "@/lib/utils"

// Grafik Dashboard Absensi. Warna status mengikuti token --chart-* (sudah
// divalidasi CVD untuk urutan ini, terang & gelap): Tepat waktu=hijau,
// Terlambat=kuning, Izin=biru, Tidak hadir=merah. Identitas tidak pernah
// hanya lewat warna: ada legenda, tooltip, dan tabel.

export const STATUS_SERIES = [
  { key: "onTime", label: "Tepat waktu", color: "var(--chart-2)" },
  { key: "late", label: "Terlambat", color: "var(--chart-4)" },
  { key: "leave", label: "Izin / cuti", color: "var(--chart-1)" },
  { key: "absent", label: "Tidak hadir", color: "var(--chart-8)" },
] as const

export type DailyChartPoint = {
  label: string // tanggal, mis. "17"
  title: string // mis. "Senin, 17 Nov 2026"
  onTime: number
  late: number
  leave: number
  absent: number
}

function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: i.color }} />
          {i.label}
          {i.value ? <span className="font-medium text-foreground tabular-nums">{i.value}</span> : null}
        </span>
      ))}
    </div>
  )
}

// Kolom bertumpuk per hari kerja: komposisi status pegawai tiap hari.
export function DailyAttendanceChart({ points }: { points: DailyChartPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const max = Math.max(1, ...points.map((p) => p.onTime + p.late + p.leave + p.absent))
  const totals = STATUS_SERIES.map((s) => points.reduce((sum, p) => sum + p[s.key], 0))
  const active = hovered === null ? null : points[hovered]

  if (points.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada hari kerja di bulan ini.</p>

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend items={STATUS_SERIES.map((s, i) => ({ label: s.label, color: s.color, value: String(totals[i]) }))} />
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Sembunyikan tabel" : "Lihat tabel"}
        </button>
      </div>

      <div className="h-5 text-xs text-muted-foreground" aria-live="polite">
        {active ? (
          <span>
            <span className="font-medium text-foreground">{active.title}</span>
            {STATUS_SERIES.map((s) => ` · ${s.label} ${active[s.key]}`).join("")}
          </span>
        ) : (
          "Arahkan kursor ke kolom untuk melihat rincian per hari."
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground tabular-nums">{max}</span>
        <div className="flex h-48 items-end gap-[3px] border-b border-border">
          {points.map((p, i) => {
            const total = p.onTime + p.late + p.leave + p.absent
            const segments = STATUS_SERIES.map((s) => ({ ...s, value: p[s.key] })).filter((s) => s.value > 0)
            return (
              <div
                key={p.title}
                className="flex h-full min-w-0 flex-1 cursor-default items-end"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                title={`${p.title}: ${STATUS_SERIES.map((s) => `${s.label} ${p[s.key]}`).join(", ")}`}
              >
                <div
                  className="flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity"
                  style={{ height: `${(total / max) * 100}%`, opacity: hovered === null || hovered === i ? 1 : 0.45 }}
                >
                  {segments.map((s) => (
                    <div key={s.key} style={{ flexGrow: s.value, flexBasis: 0, backgroundColor: s.color, minHeight: 2 }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-[3px]">
          {points.map((p, i) => (
            <span
              key={p.title}
              className={cn(
                "min-w-0 flex-1 text-center text-[10px] text-muted-foreground tabular-nums",
                // Label tanggal jarang supaya tidak bertumpuk.
                points.length > 16 && i % 2 === 1 && "invisible"
              )}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">Tanggal</th>
                {STATUS_SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-1.5 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.title} className="border-t">
                  <td className="px-3 py-1.5">{p.title}</td>
                  {STATUS_SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                      {p[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

// Kolom satu seri (mis. tingkat kehadiran per bulan). Nilai tampil saat
// hover; hanya nilai terakhir yang dilabel langsung.
export function ColumnSeriesChart({
  rows,
  color,
  height = 150,
  emptyMessage = "Belum ada data.",
}: {
  rows: { label: string; title: string; value: number | null; display: string }[]
  color: string
  height?: number
  emptyMessage?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const values = rows.map((r) => r.value ?? 0)
  const max = Math.max(1e-9, ...values)
  if (rows.every((r) => r.value === null || r.value === 0)) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }
  const lastIndex = rows.length - 1
  const active = hovered ?? lastIndex

  return (
    <div className="grid gap-2">
      <div className="h-5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{rows[active].title}</span> · {rows[active].display}
      </div>
      <div className="flex items-end gap-1.5 border-b border-border" style={{ height }}>
        {rows.map((r, i) => (
          <div
            key={r.title}
            className="flex h-full min-w-0 flex-1 items-end"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            title={`${r.title}: ${r.display}`}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: r.value === null ? 0 : `${Math.max(2, (r.value / max) * 100)}%`,
                backgroundColor: color,
                opacity: hovered === null ? (i === lastIndex ? 1 : 0.75) : hovered === i ? 1 : 0.4,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {rows.map((r) => (
          <span key={r.title} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export type RankItem = { key: string; name: string; sub: string; count: number; detail?: string; href?: string }

// Peringkat pegawai (mis. paling sering terlambat): bar tipis + angka.
export function RankList({
  items,
  color,
  unit,
  emptyMessage,
  limit = 8,
}: {
  items: RankItem[]
  color: string
  unit: string
  emptyMessage: string
  limit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  const shown = expanded ? items : items.slice(0, limit)
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="grid gap-1">
      {shown.map((item, idx) => {
        const name = item.href ? (
          <Link href={item.href} className="truncate font-medium hover:underline">
            {item.name}
          </Link>
        ) : (
          <span className="truncate font-medium">{item.name}</span>
        )
        return (
          <div key={item.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-1.5 py-1.5 hover:bg-muted/50">
            <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-baseline gap-2 text-sm">
                {name}
                <span className="truncate text-xs text-muted-foreground">{item.sub}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: color }} />
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold tabular-nums">
                {item.count} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
              {item.detail ? <span className="block text-[11px] text-muted-foreground">{item.detail}</span> : null}
            </div>
          </div>
        )
      })}
      {items.length > limit ? (
        <button type="button" className="mt-1 text-left text-xs text-primary hover:underline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Tampilkan lebih sedikit" : `Tampilkan semua (${items.length})`}
        </button>
      ) : null}
    </div>
  )
}

// Bar horizontal persentase (mis. tingkat kehadiran per bagian).
export function PercentBars({
  rows,
  color,
}: {
  rows: { label: string; value: number; detail: string }[]
  color: string
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada data.</p>
  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3" title={`${r.label}: ${r.detail}`}>
          <span className="truncate text-xs text-muted-foreground">{r.label}</span>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.round(r.value * 100)}%`, backgroundColor: color }} />
          </div>
          <span className="text-right text-sm font-semibold tabular-nums">{(r.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}
