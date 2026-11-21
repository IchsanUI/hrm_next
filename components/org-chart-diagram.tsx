"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Download, Loader2, Maximize2, Moon, Sun, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"

import type { OrgTreeNode } from "@/lib/org-tree"
import { getLevelInfo } from "@/components/org-chart-tree"
import { Button } from "@/components/ui/button"

// Bagan struktur organisasi (atas → bawah) digambar sebagai SVG murni dengan
// palet warna TETAP (Terang atau Gelap, dipilih pengguna) — sengaja tidak
// memakai token CSS tema, supaya hasil unduhan PNG/JPEG identik dengan yang
// tampil di layar. Font memakai keluarga sistem (Arial/Helvetica) karena web
// font tidak ikut termuat saat SVG dirender ke canvas untuk diekspor.

const NODE_W = 216
const NODE_H = 88
const H_GAP = 20
const V_GAP = 56
const PAD = 32
const HEADER_H = 84
const LEGEND_H = 36
const FONT = "Arial, Helvetica, sans-serif"

type ChartTheme = "terang" | "gelap"

const PALETTE = {
  terang: {
    bg: "#ffffff",
    nodeFill: "#ffffff",
    nodeStroke: "#d6dae3",
    externalFill: "#faf5ff",
    name: "#0f172a",
    text: "#334155",
    muted: "#64748b",
    edge: "#94a3b8",
    title: "#0f172a",
    subtitle: "#475569",
    level: { Direksi: "#1e2a5a", Manager: "#059669", Supervisor: "#2563eb", Staff: "#94a3b8", "Pihak Luar": "#7c3aed" },
  },
  gelap: {
    bg: "#0b1120",
    nodeFill: "#151e32",
    nodeStroke: "#2a3550",
    externalFill: "#1f1638",
    name: "#f1f5f9",
    text: "#cbd5e1",
    muted: "#94a3b8",
    edge: "#475569",
    title: "#f8fafc",
    subtitle: "#94a3b8",
    level: { Direksi: "#60a5fa", Manager: "#34d399", Supervisor: "#38bdf8", Staff: "#94a3b8", "Pihak Luar": "#a78bfa" },
  },
} as const

type Palette = (typeof PALETTE)[ChartTheme]
const LEVELS = ["Pihak Luar", "Direksi", "Manager", "Supervisor", "Staff"] as const
const levelColor = (palette: Palette, level: string) =>
  palette.level[level as keyof Palette["level"]] ?? palette.level.Staff
const THEME_KEY = "hris:org-chart-theme"

type Placed = { node: OrgTreeNode; x: number; y: number; level: string }
type Edge = { from: Placed; to: Placed }

// Tata letak pohon sederhana: lebar subtree = max(lebar kotak, total lebar
// anak + jarak); induk diletakkan di tengah anak-anaknya.
function layout(roots: OrgTreeNode[]) {
  const widthCache = new Map<string, number>()
  function subtreeWidth(n: OrgTreeNode): number {
    const cached = widthCache.get(n.key)
    if (cached !== undefined) return cached
    const childrenWidth =
      n.children.length === 0
        ? 0
        : n.children.reduce((s, c) => s + subtreeWidth(c), 0) + H_GAP * (n.children.length - 1)
    const w = Math.max(NODE_W, childrenWidth)
    widthCache.set(n.key, w)
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
      level: getLevelInfo(n.positionName, n.kind).label,
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

function NodeBox({ p, palette }: { p: Placed; palette: Palette }) {
  const color = levelColor(palette, p.level)
  const external = p.node.kind === "external"
  const positionLines = wrap(p.node.positionName, 30, 2)
  return (
    <g transform={`translate(${p.x}, ${p.y})`}>
      <title>{[p.node.fullName, p.node.positionName, p.node.departmentName].filter(Boolean).join("\n")}</title>
      <defs>
        <clipPath id={`org-node-${p.node.key}`}>
          <rect width={NODE_W} height={NODE_H} rx={10} />
        </clipPath>
      </defs>
      {/* Pihak luar: garis putus-putus & latar keunguan supaya beda dari pegawai. */}
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={10}
        fill={external ? palette.externalFill : palette.nodeFill}
        stroke={external ? color : palette.nodeStroke}
        strokeDasharray={external ? "5 4" : undefined}
      />
      {/* Strip warna level di tepi atas, mengikuti sudut membulat kotak */}
      <rect width={NODE_W} height={5} fill={color} clipPath={`url(#org-node-${p.node.key})`} />
      <circle cx={26} cy={32} r={15} fill={color} fillOpacity={0.15} />
      <text x={26} y={36.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} fontFamily={FONT}>
        {initials(p.node.fullName)}
      </text>
      {/* Nama panjang diperkecil sedikit dulu sebelum dipotong, supaya tidak menyentuh tepi kotak. */}
      <text
        x={50}
        y={29}
        fontSize={p.node.fullName.length > 18 ? 10 : 11.5}
        fontWeight={700}
        fill={palette.name}
        fontFamily={FONT}
      >
        {truncate(p.node.fullName, 24)}
      </text>
      <text x={50} y={43} fontSize={9.5} fontWeight={700} fill={color} fontFamily={FONT}>
        {p.level.toUpperCase()}
        {p.node.isHead ? " · KEPALA BAGIAN" : ""}
      </text>
      {positionLines.map((line, i) => (
        <text key={i} x={12} y={62 + i * 12} fontSize={10} fill={palette.text} fontFamily={FONT}>
          {line}
        </text>
      ))}
      {positionLines.length < 2 && p.node.departmentName ? (
        <text x={12} y={74} fontSize={9} fill={palette.muted} fontFamily={FONT}>
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
  const [theme, setTheme] = useState<ChartTheme>("terang")
  const palette = PALETTE[theme]
  // Tema awal: pilihan terakhir pengguna, atau mengikuti tema aplikasi.
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY)
    const initial: ChartTheme =
      saved === "gelap" || saved === "terang"
        ? saved
        : document.documentElement.classList.contains("dark")
          ? "gelap"
          : "terang"
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baca preferensi browser sekali saat mount
    setTheme(initial)
  }, [])
  function changeTheme(next: ChartTheme) {
    setTheme(next)
    window.localStorage.setItem(THEME_KEY, next)
  }
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
      ctx.fillStyle = palette.bg
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
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label="Tema bagan">
            {(
              [
                ["terang", "Terang", Sun],
                ["gelap", "Gelap", Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => changeTheme(value)}
                className={
                  theme === value
                    ? "inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                    : "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                }
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
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

      <div className="max-h-[75vh] overflow-auto rounded-xl border" style={{ background: palette.bg }}>
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
            <rect width={width} height={height} fill={palette.bg} />
            <text x={width / 2} y={36} textAnchor="middle" fontSize={18} fontWeight={700} fill={palette.title} fontFamily={FONT}>
              STRUKTUR ORGANISASI
            </text>
            <text x={width / 2} y={56} textAnchor="middle" fontSize={12} fill={palette.subtitle} fontFamily={FONT}>
              {title} · per {dateLabel}
            </text>

            {/* Garis siku induk → anak */}
            <g fill="none" stroke={palette.edge} strokeWidth={1.5}>
              {edges.map((e) => {
                const x1 = e.from.x + NODE_W / 2
                const y1 = e.from.y + NODE_H
                const x2 = e.to.x + NODE_W / 2
                const y2 = e.to.y
                const midY = y1 + V_GAP / 2
                return (
                  <path
                    key={`${e.from.node.key}-${e.to.node.key}`}
                    d={`M${x1} ${y1} V${midY} H${x2} V${y2}`}
                    strokeDasharray={e.from.node.kind === "external" || e.to.node.kind === "external" ? "6 4" : undefined}
                  />
                )
              })}
            </g>

            {placed.map((p) => (
              <NodeBox key={p.node.key} p={p} palette={palette} />
            ))}

            {/* Legenda */}
            <g transform={`translate(${PAD}, ${height - PAD})`}>
              {LEVELS.filter((label) => label !== "Pihak Luar" || placed.some((p) => p.node.kind === "external")).map((label, i) => (
                <g key={label} transform={`translate(${i * 110}, 0)`}>
                  <rect y={-9} width={12} height={12} rx={3} fill={levelColor(palette, label)} />
                  <text x={18} y={1} fontSize={11} fill={palette.text} fontFamily={FONT}>
                    {label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Bagan disusun dari atasan langsung tiap pegawai (Data Pegawai → Atasan) ditambah pihak di luar kepegawaian
        (kotak garis putus-putus). Arahkan kursor ke kotak untuk melihat nama &amp; jabatan lengkap. Unduhan mengikuti
        tema yang dipilih.
      </p>
    </div>
  )
}
