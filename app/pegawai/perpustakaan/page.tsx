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

  const docs = await prisma.libraryDocument.findMany({
    where: { isPublished: true },
    orderBy: [{ updatedAt: "desc" }],
    include: { reads: { where: { employeeId }, take: 1 } },
  })

  const items: LibraryBrowserItem[] = docs.map((d) => {
    const read = d.reads[0]
    return {
      publicId: d.publicId,
      title: d.title,
      documentNumber: d.documentNumber,
      category: d.category,
      description: d.description,
      effectiveDate: d.effectiveDate ? d.effectiveDate.toISOString().slice(0, 10) : null,
      sizeBytes: d.sizeBytes,
      pageCount: d.pageCount,
      updatedAt: d.updatedAt.toISOString(),
      readAt: read ? read.lastReadAt.toISOString() : null,
      updatedSinceRead: read ? d.updatedAt > read.lastReadAt : false,
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
            Peraturan OJK, peraturan perusahaan, dan SOP yang berlaku. Baca langsung di sini.
          </p>
        </div>
      </div>
      <LibraryBrowser items={items} />
    </div>
  )
}
