import { redirect } from "next/navigation"
import { BookOpen } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { LibraryManager, type LibraryAdminRow } from "@/components/library-manager"

export default async function KelolaPerpustakaanPage() {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "HR_ADMIN" && user.menuAccess.includes("perpustakaan.kelola"))
  if (!allowed) {
    redirect("/admin/dashboard")
  }

  const [docs, activeEmployeeCount] = await Promise.all([
    prisma.libraryDocument.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { _count: { select: { reads: { where: { employee: { isActive: true, isDeleted: false } } } } } },
    }),
    prisma.employee.count({ where: { isActive: true, isDeleted: false } }),
  ])

  const rows: LibraryAdminRow[] = docs.map((d) => ({
    publicId: d.publicId,
    title: d.title,
    documentNumber: d.documentNumber,
    category: d.category,
    description: d.description,
    effectiveDate: d.effectiveDate ? d.effectiveDate.toISOString().slice(0, 10) : null,
    originalName: d.originalName,
    sizeBytes: d.sizeBytes,
    pageCount: d.pageCount,
    isPublished: d.isPublished,
    uploadedBy: d.uploadedBy,
    updatedAt: d.updatedAt.toISOString(),
    readerCount: d._count.reads,
  }))

  const published = rows.filter((r) => r.isPublished)
  const fullyRead = published.filter((r) => activeEmployeeCount > 0 && r.readerCount >= activeEmployeeCount)
  const stats = [
    { label: "Total Dokumen", value: rows.length, hint: `${rows.length - published.length} draf` },
    { label: "Diterbitkan", value: published.length, hint: "Terlihat oleh pegawai" },
    { label: "Dibaca Semua Pegawai", value: fullyRead.length, hint: `dari ${published.length} dokumen terbit` },
    { label: "Pegawai Aktif", value: activeEmployeeCount, hint: "Target pembaca" },
  ]

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Kelola Perpustakaan" }]} />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Kelola Perpustakaan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Unggah peraturan OJK, peraturan perusahaan, dan SOP untuk dibaca pegawai, lalu pantau siapa yang
            sudah membacanya.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="py-0">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <LibraryManager rows={rows} activeEmployeeCount={activeEmployeeCount} />
    </div>
  )
}
