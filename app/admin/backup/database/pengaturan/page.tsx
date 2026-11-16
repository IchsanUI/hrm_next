import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BackupSettingsForm } from "@/components/backup-settings-form"

export default async function BackupPengaturanPage() {
  const settings = await prisma.backupSettings.findUnique({ where: { id: 1 } })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Backup</CardTitle>
        <CardDescription>
          Lokasi mysqldump.exe di server ini, dan berapa lama backup lama disimpan sebelum dihapus
          otomatis.
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
  )
}
