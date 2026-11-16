import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { Breadcrumb } from "@/components/breadcrumb"
import { BackupTabs } from "@/components/backup-tabs"

// Backup Database = gabungan Backup Manual + Riwayat Backup + Pengaturan
// Backup (dulu tiga menu/halaman terpisah).
export default async function BackupDatabaseLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  return (
    <div className="grid gap-6">
      <div>
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Backup" },
            { label: "Backup Database" },
          ]}
        />
        <h1 className="text-2xl font-semibold">Backup Database</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buat cadangan database, lihat & unduh hasilnya, dan atur penyimpanannya.
        </p>
      </div>
      <BackupTabs />
      {children}
    </div>
  )
}
