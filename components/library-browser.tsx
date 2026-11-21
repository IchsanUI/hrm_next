"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { LibraryCategory } from "@prisma/client"
import { BookOpen, CheckCircle2, FileText, Loader2, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABEL, formatFileSize } from "@/lib/library-labels"
import type { LibrarySearchHit, LibrarySearchMatch } from "@/lib/library-text-labels"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export type LibraryBrowserItem = {
  publicId: string
  title: string
  documentNumber: string | null
  category: LibraryCategory
  description: string | null
  effectiveDate: string | null // yyyy-mm-dd
  sizeBytes: number
  pageCount: number | null
  updatedAt: string // ISO
  readAt: string | null // ISO terakhir dibuka pegawai ini; null = belum pernah
  updatedSinceRead: boolean
  parts: { publicId: string; partNumber: number }[] // Bagian 2, 3, … (kosong = dokumen tunggal)
}

type SearchMode = "isi" | "judul"
const CONTENT_MIN_CHARS = 2
const DEBOUNCE_MS = 400

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function readerHref(publicId: string, page?: number, query?: string) {
  const params = new URLSearchParams()
  if (page) params.set("hal", String(page))
  if (query) params.set("q", query)
  const qs = params.toString()
  return `/pegawai/perpustakaan/${publicId}${qs ? `?${qs}` : ""}`
}

export function LibraryBrowser({ items }: { items: LibraryBrowserItem[] }) {
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<SearchMode>("isi")
  const [category, setCategory] = useState<LibraryCategory | "ALL" | "UNREAD">("ALL")
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState("")
  const requestId = useRef(0)

  const q = query.trim()
  const contentActive = mode === "isi" && q.length >= CONTENT_MIN_CHARS

  // Pencarian isi di server — debounce: baru dikirim setelah pegawai berhenti
  // mengetik DEBOUNCE_MS. Permintaan lama dibatalkan bila kata kunci berubah.
  // Lewat route handler (bukan server action) agar halaman tidak di-refresh
  // dan kotak pencarian tidak kehilangan fokus.
  useEffect(() => {
    if (!contentActive) return
    const id = ++requestId.current
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/perpustakaan/cari?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        const data = (await res.json()) as { hits?: LibrarySearchHit[] }
        if (id !== requestId.current) return
        setHits(data.hits ?? [])
        setSearchedQuery(q)
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError" || id !== requestId.current) return
        setHits([])
        setSearchedQuery(q)
      } finally {
        if (id === requestId.current) setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, contentActive])

  const unreadCount = items.filter((i) => !i.readAt || i.updatedSinceRead).length
  const categories = LIBRARY_CATEGORIES.filter((c) => items.some((i) => i.category === c))

  const hitByDoc = useMemo(
    () => new Map((contentActive && searchedQuery === q ? hits : []).map((h) => [h.publicId, h])),
    [hits, contentActive, searchedQuery, q]
  )

  const visible = useMemo(() => {
    const lower = q.toLowerCase()
    const inCategory = items.filter((i) => {
      if (category === "UNREAD" && i.readAt && !i.updatedSinceRead) return false
      if (category !== "ALL" && category !== "UNREAD" && i.category !== category) return false
      return true
    })
    if (!lower) return inCategory
    const titleMatches = inCategory.filter((i) =>
      [i.title, i.documentNumber ?? "", i.description ?? ""].some((v) => v.toLowerCase().includes(lower))
    )
    if (mode === "judul") return titleMatches
    // Judul cocok lebih dulu, lalu dokumen yang cocok di isi (urut relevansi).
    const titleIds = new Set(titleMatches.map((i) => i.publicId))
    const byId = new Map(inCategory.map((i) => [i.publicId, i]))
    const contentOnly = [...hitByDoc.keys()]
      .filter((id) => !titleIds.has(id))
      .map((id) => byId.get(id))
      .filter((i): i is LibraryBrowserItem => !!i)
    return [...titleMatches, ...contentOnly]
  }, [items, q, category, mode, hitByDoc])

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <BookOpen className="size-6" />
        </span>
        <p className="text-sm font-medium">Perpustakaan masih kosong</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Peraturan OJK, peraturan perusahaan, dan SOP yang diterbitkan HR akan muncul di sini.
        </p>
      </Card>
    )
  }

  const filters: { value: typeof category; label: string; count: number }[] = [
    { value: "ALL", label: "Semua", count: items.length },
    ...(unreadCount > 0 ? [{ value: "UNREAD" as const, label: "Belum Dibaca", count: unreadCount }] : []),
    ...categories.map((c) => ({
      value: c,
      label: LIBRARY_CATEGORY_LABEL[c],
      count: items.filter((i) => i.category === c).length,
    })),
  ]
  const contentMatchCount = visible.filter((i) => hitByDoc.has(i.publicId)).length
  const pending = contentActive && (searching || searchedQuery !== q)

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-[28rem]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "isi" ? 'Cari judul atau isi, mis. cuti haid atau "pusat data"' : "Cari judul, nomor, atau ringkasan"}
            className="pr-9 pl-8"
            aria-label="Cari dokumen"
          />
          {pending ? (
            <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <div className="inline-flex w-fit rounded-md border p-0.5 text-xs" role="radiogroup" aria-label="Cari di">
          {(
            [
              ["isi", "Judul & Isi"],
              ["judul", "Judul saja"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = category === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setCategory(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {f.label}
              <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{f.count}</span>
            </button>
          )
        })}
      </div>

      {q ? (
        <p className="text-xs text-muted-foreground">
          {pending
            ? "Mencari di isi dokumen…"
            : `${visible.length} dokumen cocok${contentActive && contentMatchCount ? ` · ${contentMatchCount} ditemukan di isi dokumen` : ""}`}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {pending ? "Mencari…" : "Tidak ada dokumen yang cocok."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <LibraryCard key={item.publicId} item={item} hit={hitByDoc.get(item.publicId) ?? null} query={contentActive ? q : ""} />
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryCard({ item, hit, query }: { item: LibraryBrowserItem; hit: LibrarySearchHit | null; query: string }) {
  const hasParts = item.parts.length > 0
  return (
    <div className="group/card flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50">
      <Link href={readerHref(item.publicId, undefined, query || undefined)} className="group flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            {LIBRARY_CATEGORY_LABEL[item.category]}
            {hasParts ? ` · ${item.parts.length + 1} bagian` : ""}
          </p>
          <p className="line-clamp-2 break-words text-sm font-semibold group-hover:text-primary">{item.title}</p>
          {item.documentNumber ? <p className="truncate text-xs text-muted-foreground">{item.documentNumber}</p> : null}
        </div>
      </Link>

      {hit ? (
        <ul className="grid gap-1.5">
          {hit.matches.map((m) => (
            <li key={`${m.publicId}-${m.page}`}>
              <SnippetLink match={m} hasParts={hasParts} query={query} />
            </li>
          ))}
          {hit.totalMatches > hit.matches.length ? (
            <li>
              <Link
                href={readerHref(hit.matches[0].publicId, hit.matches[0].page, query)}
                className="text-xs font-medium text-primary hover:underline"
              >
                +{hit.totalMatches - hit.matches.length} halaman cocok lainnya
              </Link>
            </li>
          ) : null}
        </ul>
      ) : item.description ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
      ) : null}

      {hasParts ? (
        <div className="flex flex-wrap gap-1.5">
          {[{ publicId: item.publicId, partNumber: 1 }, ...item.parts].map((p) => (
            <Link
              key={p.publicId}
              href={readerHref(p.publicId)}
              className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/5"
            >
              Bagian {p.partNumber}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="truncate">
          {item.pageCount ? `${item.pageCount} hlm · ` : ""}
          {formatFileSize(item.sizeBytes)}
          {item.effectiveDate ? ` · Berlaku ${formatDate(item.effectiveDate)}` : ""}
        </span>
        {item.updatedSinceRead ? (
          <Badge variant="secondary" className="shrink-0">
            Diperbarui
          </Badge>
        ) : item.readAt ? (
          <span className="flex shrink-0 items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Sudah dibaca
          </span>
        ) : (
          <Badge className="shrink-0">Baru</Badge>
        )}
      </div>
    </div>
  )
}

function SnippetLink({ match, hasParts, query }: { match: LibrarySearchMatch; hasParts: boolean; query: string }) {
  const location = match.partNumber
    ? `Bagian ${match.partNumber} · Hal. ${match.page}`
    : hasParts
      ? `Bagian 1 · Hal. ${match.page}`
      : `Hal. ${match.page}`
  return (
    <Link
      href={readerHref(match.publicId, match.page, query)}
      className="line-clamp-3 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs leading-5 text-muted-foreground transition-colors hover:bg-muted"
    >
      <span className="mr-1.5 inline-block rounded bg-background px-1.5 font-medium text-foreground tabular-nums">
        {location}
      </span>
      <span>
        {match.segments.map((s, i) =>
          s.hit ? (
            <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 font-semibold text-foreground dark:bg-amber-500/30">
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </span>
    </Link>
  )
}
