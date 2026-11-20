import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download, ExternalLink } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { LIBRARY_CATEGORY_LABEL, formatFileSize } from "@/lib/library-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
}

export default async function BacaDokumenPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/pegawai/dashboard")
  }

  const { publicId } = await params
  const doc = await prisma.libraryDocument.findUnique({ where: { publicId } })
  if (!doc || !doc.isPublished) {
    notFound()
  }

  const fileUrl = `/api/perpustakaan/${doc.publicId}/file`
  const meta = [
    LIBRARY_CATEGORY_LABEL[doc.category],
    doc.documentNumber,
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
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">
                  {doc.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pl-10 sm:pl-0">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={fileUrl} target="_blank" rel="noopener noreferrer" />}
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

      <div className="overflow-hidden rounded-xl border bg-muted">
        <iframe src={fileUrl} title={doc.title} className="h-[calc(100vh-14rem)] min-h-[32rem] w-full" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        PDF tidak tampil di perangkat Anda? Gunakan tombol <strong>Tab Baru</strong> atau <strong>Unduh</strong>.
      </p>
    </div>
  )
}
