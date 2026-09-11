import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { DocumentWatermarkForm } from "@/components/document-watermark-form"

export default async function PengaturanKepegawaianPage() {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  const hasAccess =
    session?.user.role === "SUPER_ADMIN" ||
    session?.user.menuAccess.includes("kepegawaian.pengaturan")
  if (!isAdminRole || !hasAccess) {
    redirect("/admin/dashboard")
  }

  const settings = await prisma.employeeDocumentSettings.findUnique({ where: { id: 1 } })

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Kepegawaian" },
          { label: "Pengaturan Kepegawaian" },
        ]}
      />

      <div>
        <h1 className="mb-1 text-2xl font-semibold">Pengaturan Kepegawaian</h1>
        <p className="text-sm text-muted-foreground">
          Pengaturan yang berlaku untuk seluruh data kepegawaian.
        </p>
      </div>

      <DocumentWatermarkForm
        // Baris pengaturan belum tentu pernah dibuat — default-nya sama dengan
        // kolom di schema (menyala), supaya dokumen identitas tidak pernah
        // tersaji tanpa penanda hanya karena halaman ini belum pernah dibuka.
        enabled={settings?.watermarkEnabled ?? true}
        text={settings?.watermarkText ?? null}
      />
    </div>
  )
}
