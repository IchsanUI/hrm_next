"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { LibraryCategory } from "@prisma/client"
import { BookOpen, CheckCircle2, FileText, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABEL, formatFileSize } from "@/lib/library-labels"
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
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

export function LibraryBrowser({ items }: { items: LibraryBrowserItem[] }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<LibraryCategory | "ALL" | "UNREAD">("ALL")

  const unreadCount = items.filter((i) => !i.readAt || i.updatedSinceRead).length
  const categories = LIBRARY_CATEGORIES.filter((c) => items.some((i) => i.category === c))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (category === "UNREAD" && i.readAt && !i.updatedSinceRead) return false
      if (category !== "ALL" && category !== "UNREAD" && i.category !== category) return false
      if (!q) return true
      return [i.title, i.documentNumber ?? "", i.description ?? ""].some((v) => v.toLowerCase().includes(q))
    })
  }, [items, query, category])

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

  return (
    <div className="grid gap-4">
      <div className="relative sm:w-96">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari judul, nomor, atau isi ringkasan"
          className="pl-8"
        />
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

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada dokumen yang cocok.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.publicId}
              href={`/pegawai/perpustakaan/${item.publicId}`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{LIBRARY_CATEGORY_LABEL[item.category]}</p>
                  <p className="line-clamp-2 break-words text-sm font-semibold group-hover:text-primary">
                    {item.title}
                  </p>
                  {item.documentNumber ? (
                    <p className="truncate text-xs text-muted-foreground">{item.documentNumber}</p>
                  ) : null}
                </div>
              </div>
              {item.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                <span className="truncate">
                  {item.pageCount ? `${item.pageCount} hlm · ` : ""}
                  {formatFileSize(item.sizeBytes)}
                  {item.effectiveDate ? ` · Berlaku ${formatDate(item.effectiveDate)}` : ""}
                </span>
                {item.updatedSinceRead ? (
                  <Badge variant="secondary" className="shrink-0">Diperbarui</Badge>
                ) : item.readAt ? (
                  <span className="flex shrink-0 items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    Sudah dibaca
                  </span>
                ) : (
                  <Badge className="shrink-0">Baru</Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
