"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import Link from "next/link"
import { AlertTriangle, Loader2 } from "lucide-react"

import "./library-pdf-viewer.css"

// Penampil "sorot" Perpustakaan: merender SATU halaman PDF dengan pdf.js
// (gambar + lapisan teks) lalu menyorot kata yang dicari dengan warna kuning.
// Penampil PDF bawaan browser tidak bisa disorot dari luar, jadi ini dipakai
// saat dokumen dibuka dari hasil pencarian. Dokumen dimuat sekali lalu
// dipakai ulang saat pindah halaman.

type Props = {
  fileUrl: string
  page: number
  terms: string[] // kata/frasa pencarian (huruf kecil)
  fallbackHref?: string // tampilan PDF biasa bila mode sorot gagal
}

const MIN_TERM = 3

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function wordPart(w: string) {
  return w.length < MIN_TERM ? `(?<![\\p{L}\\p{N}])${escapeRegExp(w)}(?![\\p{L}\\p{N}])` : escapeRegExp(w)
}

// Dua pola: (1) frasa utuh ("penyedia jasa" → penyedia\s+jasa) + kata
// tunggal; (2) cadangan — semua kata dipisah, dipakai bila frasa tidak
// ditemukan utuh karena lapisan teks pdf.js memotong baris jadi beberapa potongan.
function buildPatterns(terms: string[]): { exact: RegExp; loose: RegExp } | null {
  const clean = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length)
  if (!clean.length) return null
  const exact = clean.map((t) => t.split(/\s+/).map(wordPart).join("\\s+")).join("|")
  const words = [...new Set(clean.flatMap((t) => t.split(/\s+/)).filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length)
  return { exact: new RegExp(exact, "giu"), loose: new RegExp(words.map(wordPart).join("|"), "giu") }
}

function countMatches(texts: string[], pattern: RegExp) {
  return texts.reduce((sum, text) => sum + (text.match(pattern)?.length ?? 0), 0)
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null
function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
    return pdfjs
  })
  return pdfjsPromise
}

export function LibraryPdfHighlightViewer({ fileUrl, page, terms, fallbackHref }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<{ url: string; doc: Promise<PDFDocumentProxy> } | null>(null)
  const [width, setWidth] = useState(0)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [hitCount, setHitCount] = useState(0)
  const patterns = useMemo(() => buildPatterns(terms), [terms])

  // Lebar wadah → skala halaman (ikut berubah saat layar diputar/diubah).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let frame = 0
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setWidth(Math.floor(entries[0].contentRect.width)))
    })
    observer.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!width) return
    let cancelled = false
    let renderTask: RenderTask | null = null

    async function draw() {
      setState("loading")
      const pdfjs = await loadPdfjs()
      if (!docRef.current || docRef.current.url !== fileUrl) {
        docRef.current = { url: fileUrl, doc: pdfjs.getDocument({ url: fileUrl, withCredentials: true }).promise }
      }
      const doc = await docRef.current.doc
      const pdfPage = await doc.getPage(Math.min(Math.max(1, page), doc.numPages))
      if (cancelled) return

      const base = pdfPage.getViewport({ scale: 1 })
      const scale = width / base.width
      const viewport = pdfPage.getViewport({ scale })
      const ratio = window.devicePixelRatio || 1

      const canvas = canvasRef.current!
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      renderTask = pdfPage.render({
        canvasContext: canvas.getContext("2d")!,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      })

      const container = textRef.current!
      container.replaceChildren()
      container.style.setProperty("--scale-factor", String(scale))
      const textLayer = new pdfjs.TextLayer({ textContentSource: pdfPage.streamTextContent(), container, viewport })
      await Promise.all([renderTask.promise, textLayer.render()])
      if (cancelled) return

      // Sorot. pdf.js memecah baris (terutama teks rata kiri-kanan) menjadi
      // banyak potongan, jadi kecocokan dicari di gabungan semua potongan
      // (dipisah spasi) lalu dipetakan balik ke potongan masing-masing —
      // frasa "penyedia jasa" tetap tersorot walau tiap kata potongan sendiri.
      let hits = 0
      if (patterns) {
        const divs = textLayer.textDivs
        const texts = divs.map((div, i) => textLayer.textContentItemsStr[i] ?? div.textContent ?? "")
        const starts: number[] = []
        let combined = ""
        texts.forEach((text, i) => {
          if (i > 0) combined += " "
          starts.push(combined.length)
          combined += text
        })
        const pattern = countMatches([combined], patterns.exact) > 0 ? patterns.exact : patterns.loose
        const ranges = [...combined.matchAll(pattern)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as const)
        hits = ranges.length

        let r = 0
        texts.forEach((text, i) => {
          const from = starts[i]
          const to = from + text.length
          while (r < ranges.length && ranges[r][1] <= from) r++
          if (r >= ranges.length || ranges[r][0] >= to) return
          const fragment = document.createDocumentFragment()
          let last = 0
          for (let k = r; k < ranges.length && ranges[k][0] < to; k++) {
            const a = Math.max(ranges[k][0], from) - from
            const b = Math.min(ranges[k][1], to) - from
            if (a > last) fragment.append(text.slice(last, a))
            const mark = document.createElement("mark")
            mark.className = k === 0 ? "hris-hl hris-hl-first" : "hris-hl"
            mark.textContent = text.slice(a, b)
            fragment.append(mark)
            last = b
          }
          if (last < text.length) fragment.append(text.slice(last))
          divs[i].replaceChildren(fragment)
        })
      }
      setHitCount(hits)
      setState("ready")

      // Gulir ke sorotan pertama bila berada di bawah layar.
      const first = container.querySelector("mark.hris-hl-first")
      if (first) first.scrollIntoView({ block: "center", behavior: "smooth" })
    }

    draw().catch((error) => {
      if (cancelled || (error as { name?: string })?.name === "RenderingCancelledException") return
      console.error("Gagal merender PDF:", error)
      setState("error")
    })
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [fileUrl, page, width, patterns])

  return (
    <div ref={wrapRef} className="relative w-full">
      {state === "ready" && patterns ? (
        <p className="sticky top-0 z-10 mb-2 w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm dark:bg-amber-900/60 dark:text-amber-100">
          {hitCount ? `${hitCount} sorotan di halaman ini` : "Kata yang dicari tidak terlihat di lapisan teks halaman ini"}
        </p>
      ) : null}
      <div className="relative mx-auto w-fit overflow-hidden rounded-md bg-white shadow-sm">
        <canvas ref={canvasRef} className="block" />
        <div ref={textRef} className="hris-pdf-text" />
      </div>
      {state === "loading" ? (
        <div className="absolute inset-0 flex min-h-64 items-start justify-center pt-24">
          <span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-sm text-muted-foreground shadow">
            <Loader2 className="size-4 animate-spin" />
            Memuat halaman…
          </span>
        </div>
      ) : null}
      {state === "error" ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <AlertTriangle className="size-5 text-amber-600" />
          Halaman tidak dapat ditampilkan dalam mode sorot.
          {fallbackHref ? (
            <Link href={fallbackHref} className="font-medium text-primary hover:underline">
              Buka tampilan PDF biasa
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
