import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { BackupHistoryTable } from "@/components/backup-history-table"
import { AttendanceDateFilter } from "@/components/attendance-date-filter"

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseDateValue(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export default async function BackupRiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>
}) {
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
      <Card>
        <CardContent>
          <BackupHistoryTable
            rows={backups}
            filters={
              <AttendanceDateFilter
                key={`${dari}-${sampai}`}
                initialFrom={dari}
                initialTo={sampai}
                basePath="/admin/backup/database/riwayat"
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
