"use client"

import { useMemo, useRef, useState } from "react"
import { Download, Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"

import type { OrgTreeNode } from "@/lib/org-tree"
import { getLevelInfo } from "@/components/org-chart-tree"
import { Button } from "@/components/ui/button"

// Bagan struktur organisasi (atas → bawah) digambar sebagai SVG murni dengan
// warna TETAP di atas latar putih — sengaja tidak memakai token tema, supaya
// hasil unduhan PNG/JPEG identik dengan yang tampil di layar, terang maupun
// gelap. Font memakai keluarga sistem (Arial/Helvetica) karena web font
// tidak ikut termuat saat SVG dirender ke canvas untuk diekspor.

const NODE_W = 216
const NODE_H = 88
const H_GAP = 20
const V_GAP = 56
const PAD = 32
const HEADER_H = 84
const LEGEND_H = 36
const FONT = "Arial, Helvetica, sans-serif"

const LEVEL_COLOR: Record<string, string> = {
  Direksi: "#1e2a5a",
  Manager: "#059669",
  Supervisor: "#2563eb",
  Staff: "#94a3b8",
}

type Placed = { node: OrgTreeNode; x: number; y: number; level: string }
type Edge = { from: Placed; to: Placed }

// Tata letak pohon sederhana: lebar subtree = max(lebar kotak, total lebar
// anak + jarak); induk diletakkan di tengah anak-anaknya.
function layout(roots: OrgTreeNode[]) {
  const widthCache = new Map<number, number>()
  function subtreeWidth(n: OrgTreeNode): number {
    const cached = widthCache.get(n.id)
    if (cached !== undefined) return cached
    const childrenWidth =
      n.children.length === 0
        ? 0
        : n.children.reduce((s, c) => s + subtreeWidth(c), 0) + H_GAP * (n.children.length - 1)
    const w = Math.max(NODE_W, childrenWidth)
    widthCache.set(n.id, w)
    return w
  }

  const placed: Placed[] = []
  const edges: Edge[] = []
  let maxDepth = 0

  function place(n: OrgTreeNode, left: number, depth: number, parent: Placed | null) {
    maxDepth = Math.max(maxDepth, depth)
    const w = subtreeWidth(n)
    const p: Placed = {
      node: n,
      x: left + (w - NODE_W) / 2,
      y: HEADER_H + depth * (NODE_H + V_GAP),
      level: getLevelInfo(n.positionName).label,
    }
    placed.push(p)
    if (parent) edges.push({ from: parent, to: p })

    const childrenWidth = n.children.reduce((s, c) => s + subtreeWidth(c), 0) + H_GAP * Math.max(0, n.children.length - 1)
    let cursor = left + (w - childrenWidth) / 2
    for (const c of n.children) {
      place(c, cursor, depth + 1, p)
      cursor += subtreeWidth(c) + H_GAP
    }
  }

  let cursor = PAD
  for (const r of roots) {
    place(r, cursor, 0, null)
    cursor += subtreeWidth(r) + H_GAP * 2
  }

  const width = Math.max(cursor - H_GAP * 2 + PAD, 480)
  const height = HEADER_H + (maxDepth + 1) * (NODE_H + V_GAP) - V_GAP + LEGEND_H + PAD
  return { placed, edges, width, height }
}

// Potong teks per baris berdasarkan perkiraan lebar karakter (SVG tidak
// membungkus teks otomatis).
function wrap(text: string, maxChars: number, maxLines: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length > maxLines) lines.length = maxLines
  const used = lines.join(" ").length
  if (used < text.length && lines.length > 0) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = `${last.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
  }
  return lines
}

function truncate(text: string, maxChars: number) {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function NodeBox({ p }: { p: Placed }) {
  const color = LEVEL_COLOR[p.level] ?? LEVEL_COLOR.Staff
  const positionLines = wrap(p.node.positionName, 30, 2)
  return (
    <g transform={`translate(${p.x}, ${p.y})`}>
      <title>{`${p.node.fullName}\n${p.node.positionName}\n${p.node.departmentName}`}</title>
      <defs>
        <clipPath id={`org-node-${p.node.id}`}>
          <rect width={NODE_W} height={NODE_H} rx={10} />
        </clipPath>
      </defs>
      <rect width={NODE_W} height={NODE_H} rx={10} fill="#ffffff" stroke="#d6dae3" />
      {/* Strip warna level di tepi atas, mengikuti sudut membulat kotak */}
      <rect width={NODE_W} height={5} fill={color} clipPath={`url(#org-node-${p.node.id})`} />
      <circle cx={26} cy={32} r={15} fill={color} fillOpacity={0.12} />
      <text x={26} y={36.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} fontFamily={FONT}>
        {initials(p.node.fullName)}
      </text>
      {/* Nama panjang diperkecil sedikit dulu sebelum dipotong, supaya tidak menyentuh tepi kotak. */}
      <text
        x={50}
        y={29}
        fontSize={p.node.fullName.length > 18 ? 10 : 11.5}
        fontWeight={700}
        fill="#0f172a"
        fontFamily={FONT}
      >
        {truncate(p.node.fullName, 24)}
      </text>
      <text x={50} y={43} fontSize={9.5} fontWeight={700} fill={color} fontFamily={FONT}>
        {p.level.toUpperCase()}
        {p.node.isHead ? " · KEPALA BAGIAN" : ""}
      </text>
      {positionLines.map((line, i) => (
        <text key={i} x={12} y={62 + i * 12} fontSize={10} fill="#334155" fontFamily={FONT}>
          {line}
        </text>
      ))}
      {positionLines.length < 2 ? (
        <text x={12} y={74} fontSize={9} fill="#64748b" fontFamily={FONT}>
          {truncate(p.node.departmentName, 34)}
        </text>
      ) : null}
    </g>
  )
}

function slug(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function OrgChartDiagram({ roots, title }: { roots: OrgTreeNode[]; title: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [exporting, setExporting] = useState<null | "png" | "jpeg">(null)
  const { placed, edges, width, height } = useMemo(() => layout(roots), [roots])
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    []
  )

  async function download(format: "png" | "jpeg") {
    const svg = svgRef.current
    if (!svg) return
    setExporting(format)
    try {
      const xml = new XMLSerializer().serializeToString(svg)
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }))
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Gagal merender bagan."))
        img.src = url
      })
      // Resolusi 2x supaya tetap tajam saat dicetak/di-zoom; dibatasi agar
      // tidak melewati batas ukuran canvas browser.
      const scale = Math.min(2, 16000 / Math.max(width, height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas tidak tersedia.")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, format === "png" ? "image/png" : "image/jpeg", 0.95)
      )
      if (!blob) throw new Error("Gagal membuat file gambar.")
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `Struktur-Organisasi-${slug(new Date().toISOString().slice(0, 10))}.${format === "png" ? "png" : "jpg"}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh bagan.")
    } finally {
      setExporting(null)
    }
  }

  if (roots.length === 0) {
    return <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Belum ada data struktur.</p>
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(1)))} aria-label="Perkecil">
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon-sm" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))} aria-label="Perbesar">
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>
            <Maximize2 className="size-3.5" />
            100%
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => download("png")} disabled={exporting !== null}>
            {exporting === "png" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Unduh PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => download("jpeg")} disabled={exporting !== null}>
            {exporting === "jpeg" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Unduh JPEG
          </Button>
        </div>
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-xl border bg-white">
        <div style={{ width: width * zoom, height: height * zoom }}>
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", display: "block" }}
            role="img"
            aria-label={`Bagan struktur organisasi ${title}`}
          >
            <rect width={width} height={height} fill="#ffffff" />
            <text x={width / 2} y={36} textAnchor="middle" fontSize={18} fontWeight={700} fill="#0f172a" fontFamily={FONT}>
              STRUKTUR ORGANISASI
            </text>
            <text x={width / 2} y={56} textAnchor="middle" fontSize={12} fill="#475569" fontFamily={FONT}>
              {title} · per {dateLabel}
            </text>

            {/* Garis siku induk → anak */}
            <g fill="none" stroke="#94a3b8" strokeWidth={1.5}>
              {edges.map((e) => {
                const x1 = e.from.x + NODE_W / 2
                const y1 = e.from.y + NODE_H
                const x2 = e.to.x + NODE_W / 2
                const y2 = e.to.y
                const midY = y1 + V_GAP / 2
                return <path key={`${e.from.node.id}-${e.to.node.id}`} d={`M${x1} ${y1} V${midY} H${x2} V${y2}`} />
              })}
            </g>

            {placed.map((p) => (
              <NodeBox key={p.node.id} p={p} />
            ))}

            {/* Legenda */}
            <g transform={`translate(${PAD}, ${height - PAD})`}>
              {Object.entries(LEVEL_COLOR).map(([label, color], i) => (
                <g key={label} transform={`translate(${i * 110}, 0)`}>
                  <rect y={-9} width={12} height={12} rx={3} fill={color} />
                  <text x={18} y={1} fontSize={11} fill="#334155" fontFamily={FONT}>
                    {label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Bagan disusun dari atasan langsung tiap pegawai (Data Pegawai → Atasan). Arahkan kursor ke kotak untuk melihat
        nama &amp; jabatan lengkap.
      </p>
    </div>
  )
}
