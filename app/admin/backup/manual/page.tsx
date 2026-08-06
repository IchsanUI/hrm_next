import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BackupTriggerForm } from "@/components/backup-trigger-form"
import { BackupSettingsForm } from "@/components/backup-settings-form"

export default async function BackupManualPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const settings = await prisma.backupSettings.findUnique({ where: { id: 1 } })

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Backup" },
          { label: "Backup Manual" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold">Backup Manual</h1>
        <p className="text-sm text-muted-foreground">
          Picu backup database kapan saja tanpa menunggu jadwal otomatis. Cuma bisa diakses
          SUPER_ADMIN.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backup Sekarang</CardTitle>
          <CardDescription>
            Pilih cakupan lalu picu backup — prosesnya berjalan di belakang layar, tidak
            memblokir aktivitas admin lain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupTriggerForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Backup</CardTitle>
          <CardDescription>
            Lokasi mysqldump.exe di server ini, dan berapa lama backup lama disimpan sebelum
            dihapus otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupSettingsForm
            key={`${settings?.mysqldumpPath ?? ""}-${settings?.retentionDays ?? 30}`}
            mysqldumpPath={settings?.mysqldumpPath ?? ""}
            retentionDays={settings?.retentionDays ?? 30}
          />
        </CardContent>
      </Card>
    </div>
  )
}
