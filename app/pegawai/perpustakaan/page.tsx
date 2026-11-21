import { redirect } from "next/navigation"
import { BookOpen } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { LibraryBrowser, type LibraryBrowserItem } from "@/components/library-browser"

export default async function PerpustakaanPage() {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) {
    redirect("/pegawai/dashboard")
  }

  // Satu kartu per dokumen utama; bagian lanjutan (Bagian 2, 3, …) ikut di
  // dalam kartunya.
  const docs = await prisma.libraryDocument.findMany({
    where: { isPublished: true, partOfId: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      reads: { where: { employeeId }, take: 1 },
      parts: {
        where: { isPublished: true },
        orderBy: { partNumber: "asc" },
        select: {
          publicId: true,
          partNumber: true,
          pageCount: true,
          sizeBytes: true,
          reads: { where: { employeeId }, take: 1, select: { lastReadAt: true } },
        },
      },
    },
  })

  const items: LibraryBrowserItem[] = docs.map((d) => {
    // Sudah dibaca bila salah satu bagian pernah dibuka.
    const readTimes = [d.reads[0]?.lastReadAt, ...d.parts.map((p) => p.reads[0]?.lastReadAt)].filter(
      (t): t is Date => !!t
    )
    const lastRead = readTimes.length ? new Date(Math.max(...readTimes.map((t) => t.getTime()))) : null
    return {
      publicId: d.publicId,
      title: d.title,
      documentNumber: d.documentNumber,
      category: d.category,
      description: d.description,
      effectiveDate: d.effectiveDate ? d.effectiveDate.toISOString().slice(0, 10) : null,
      sizeBytes: d.sizeBytes + d.parts.reduce((s, p) => s + p.sizeBytes, 0),
      pageCount: d.pageCount === null ? null : d.pageCount + d.parts.reduce((s, p) => s + (p.pageCount ?? 0), 0),
      updatedAt: d.updatedAt.toISOString(),
      readAt: lastRead ? lastRead.toISOString() : null,
      updatedSinceRead: lastRead ? d.updatedAt > lastRead : false,
      parts: d.parts.map((p) => ({ publicId: p.publicId, partNumber: p.partNumber ?? 0 })),
    }
  })

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Perpustakaan" }]} />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Perpustakaan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Peraturan OJK, peraturan perusahaan, dan SOP yang berlaku. Cari judul maupun isi dokumen, lalu baca
            langsung di sini.
          </p>
        </div>
      </div>
      <LibraryBrowser items={items} />
    </div>
  )
}
