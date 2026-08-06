import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { BackupHistoryTable } from "@/components/backup-history-table"
import { AttendanceDateFilter } from "@/components/attendance-date-filter"

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseDateValue(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export default async function RiwayatBackupPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>
}) {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const params = await searchParams
  const now = new Date()
  const today = dateValue(now)
  const monthAgoDate = new Date(now)
  monthAgoDate.setDate(monthAgoDate.getDate() - 30)
  const monthAgo = dateValue(monthAgoDate)
  const dari = parseDateValue(params.dari, monthAgo)
  const sampai = parseDateValue(params.sampai, today)

  const backups = await prisma.backup.findMany({
    where: {
      startedAt: { gte: new Date(`${dari}T00:00:00`), lte: new Date(`${sampai}T23:59:59.999`) },
    },
    orderBy: { startedAt: "desc" },
    select: {
      publicId: true,
      scope: true,
      status: true,
      triggeredByUsername: true,
      fileSizeBytes: true,
      startedAt: true,
      errorMessage: true,
    },
  })

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Backup" },
          { label: "Riwayat Backup" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold">Riwayat Backup</h1>
        <p className="text-sm text-muted-foreground">
          Daftar seluruh backup yang pernah dibuat, baik yang masih berjalan, berhasil, maupun
          gagal.
        </p>
      </div>

      <Card>
        <CardContent>
          <BackupHistoryTable
            rows={backups}
            filters={
              <AttendanceDateFilter
                key={`${dari}-${sampai}`}
                initialFrom={dari}
                initialTo={sampai}
                basePath="/admin/backup/riwayat"
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
