import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Highlighter, Search, X } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { LIBRARY_CATEGORY_LABEL, formatFileSize } from "@/lib/library-labels"
import { parseSearchQuery, searchLibraryContent } from "@/lib/library-search"
import { LibraryPdfHighlightViewer } from "@/components/library-pdf-highlight-viewer"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
}

function href(publicId: string, page?: number | null, q?: string, plain?: boolean) {
  const params = new URLSearchParams()
  if (page) params.set("hal", String(page))
  if (q) params.set("q", q)
  if (plain) params.set("tampilan", "pdf")
  const qs = params.toString()
  return `/pegawai/perpustakaan/${publicId}${qs ? `?${qs}` : ""}`
}

const MAX_PAGE_LINKS = 30

export default async function BacaDokumenPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>
  searchParams: Promise<{ hal?: string; q?: string; tampilan?: string }>
}) {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/pegawai/dashboard")
  }

  const { publicId } = await params
  const { hal, q: rawQuery, tampilan } = await searchParams
  const doc = await prisma.libraryDocument.findUnique({ where: { publicId } })
  if (!doc || !doc.isPublished) {
    notFound()
  }

  const page = Number(hal)
  const requestedPage = Number.isInteger(page) && page >= 1 && (!doc.pageCount || page <= doc.pageCount) ? page : null
  const query = (rawQuery ?? "").trim().slice(0, 200)

  // Bagian dokumen: semua bagian dari dokumen utama yang sama.
  const rootId = doc.partOfId ?? doc.id
  const siblings = await prisma.libraryDocument.findMany({
    where: { OR: [{ id: rootId }, { partOfId: rootId }], isPublished: true },
    select: { publicId: true, partNumber: true, partOfId: true },
  })
  const parts = siblings
    .map((s) => ({ publicId: s.publicId, number: s.partOfId ? (s.partNumber ?? 0) : 1 }))
    .sort((a, b) => a.number - b.number)
  const currentPart = doc.partOfId ? doc.partNumber : 1

  // Halaman yang cocok dengan pencarian di dokumen/bagian ini.
  const matchedPages = query
    ? ((await searchLibraryContent(query, { documentIds: [doc.id] })).pagesByDocument.get(doc.id) ?? [])
    : []
  // Dibuka dari hasil pencarian → mode sorot (kata dicari disorot kuning),
  // langsung di halaman cocok pertama. ?tampilan=pdf = penampil PDF browser.
  const highlightMode = matchedPages.length > 0 && tampilan !== "pdf"
  const currentPage = requestedPage ?? (query ? (matchedPages[0] ?? null) : null)
  const highlightTerms = query ? parseSearchQuery(query).terms : []
  const totalPages = doc.pageCount ?? 0

  const fileUrl = `/api/perpustakaan/${doc.publicId}/file`
  const viewerUrl = `${fileUrl}${currentPage ? `#page=${currentPage}` : ""}`
  const meta = [
    LIBRARY_CATEGORY_LABEL[doc.category],
    doc.documentNumber,
    parts.length > 1 ? `Bagian ${currentPart} dari ${parts.length}` : null,
    doc.effectiveDate ? `Berlaku ${formatDate(doc.effectiveDate)}` : null,
    doc.pageCount ? `${doc.pageCount} halaman` : null,
    formatFileSize(doc.sizeBytes),
  ].filter(Boolean)

  return (
    <div className="flex flex-col">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Perpustakaan", href: "/pegawai/perpustakaan" },
          { label: "Baca Dokumen" },
        ]}
      />
      <div className="mb-4 rounded-xl border border-border bg-card p-3.5 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0"
              nativeButton={false}
              render={<Link href="/pegawai/perpustakaan" aria-label="Kembali ke Perpustakaan" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <h1 title={doc.title} className="line-clamp-2 break-words text-base font-semibold leading-snug sm:text-xl">
                {doc.title}
              </h1>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">{meta.join(" · ")}</p>
              {doc.description ? (
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{doc.description}</p>
              ) : null}
              {parts.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {parts.map((p) => (
                    <Link
                      key={p.publicId}
                      href={href(p.publicId, null, query || undefined)}
                      aria-current={p.number === currentPart ? "page" : undefined}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        p.number === currentPart
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:border-primary hover:bg-primary/5"
                      )}
                    >
                      Bagian {p.number}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pl-10 sm:pl-0">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={viewerUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-4" />
              Tab Baru
            </Button>
            <Button size="sm" nativeButton={false} render={<a href={`${fileUrl}?download=1`} />}>
              <Download className="size-4" />
              Unduh
            </Button>
          </div>
        </div>
      </div>

      {query ? (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center">
          <span className="flex shrink-0 items-center gap-1.5">
            <Search className="size-4" />
            {matchedPages.length ? (
              <>
                “{query}” ditemukan di {matchedPages.length} halaman:
              </>
            ) : (
              <>“{query}” tidak ditemukan di {parts.length > 1 ? "bagian" : "dokumen"} ini.</>
            )}
          </span>
          {matchedPages.length ? (
            <div className="flex flex-wrap gap-1">
              {matchedPages.slice(0, MAX_PAGE_LINKS).map((p) => (
                <Link
                  key={p}
                  href={href(doc.publicId, p, query)}
                  aria-current={p === currentPage ? "page" : undefined}
                  className={cn(
                    "min-w-8 rounded-md border px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors",
                    p === currentPage
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-amber-300 bg-white/60 hover:bg-white dark:border-amber-800 dark:bg-transparent dark:hover:bg-amber-900/40"
                  )}
                >
                  {p}
                </Link>
              ))}
              {matchedPages.length > MAX_PAGE_LINKS ? (
                <span className="px-1 text-xs">+{matchedPages.length - MAX_PAGE_LINKS} lagi</span>
              ) : null}
            </div>
          ) : null}
          <Link
            href={href(doc.publicId, currentPage)}
            className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
            aria-label="Tutup hasil pencarian"
          >
            <X className="size-3.5" />
            Tutup
          </Link>
        </div>
      ) : null}

      {matchedPages.length ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {highlightMode && currentPage ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Halaman sebelumnya"
                disabled={currentPage <= 1}
                nativeButton={false}
                render={<Link href={href(doc.publicId, Math.max(1, currentPage - 1), query)} />}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-1.5 font-medium tabular-nums">
                Halaman {currentPage}
                {totalPages ? ` dari ${totalPages}` : ""}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Halaman berikutnya"
                disabled={!!totalPages && currentPage >= totalPages}
                nativeButton={false}
                render={
                  <Link href={href(doc.publicId, totalPages ? Math.min(totalPages, currentPage + 1) : currentPage + 1, query)} />
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : (
            <span />
          )}
          {highlightMode ? (
            <Link
              href={href(doc.publicId, currentPage, query, true)}
              className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
            >
              <FileText className="size-3.5" />
              Tampilan PDF biasa
            </Link>
          ) : (
            <Link
              href={href(doc.publicId, currentPage, query)}
              className="flex items-center gap-1 font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              <Highlighter className="size-3.5" />
              Tampilkan sorotan kata
            </Link>
          )}
        </div>
      ) : null}

      {highlightMode && currentPage ? (
        <div className="max-h-[calc(100vh-12rem)] min-h-[32rem] overflow-y-auto rounded-xl border bg-muted p-2 sm:p-4">
          <LibraryPdfHighlightViewer
            fileUrl={fileUrl}
            page={currentPage}
            terms={highlightTerms}
            fallbackHref={href(doc.publicId, currentPage, query, true)}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-muted">
          {/* key: ganti halaman (#page) memuat ulang penampil PDF browser. */}
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            title={doc.title}
            className="h-[calc(100vh-14rem)] min-h-[32rem] w-full"
          />
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {highlightMode ? "Kata yang dicari disorot kuning; sorotan oranye adalah kecocokan pertama di halaman ini. " : ""}
        PDF tidak tampil di perangkat Anda? Gunakan tombol <strong>Tab Baru</strong> atau <strong>Unduh</strong>.
        {currentPage && !highlightMode ? ` Dibuka di halaman ${currentPage}.` : ""}
      </p>
    </div>
  )
}
