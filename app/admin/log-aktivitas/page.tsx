import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { ActivityLogTable } from "@/components/activity-log-table"
import { ActivityLogDateFilter } from "@/components/activity-log-date-filter"
import { AutoRefresh } from "@/components/auto-refresh"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function parseDateValue(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export default async function LogAktivitasPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>
}) {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const params = await searchParams
  const today = todayDateValue()
  const dari = parseDateValue(params.dari, today)
  const sampai = parseDateValue(params.sampai, today)

  const start = new Date(`${dari}T00:00:00`)
  const end = new Date(`${sampai}T23:59:59.999`)

  const logs = await prisma.activityLog.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Log Aktivitas" },
        ]}
      />
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Log Aktivitas</h1>
        <AutoRefresh intervalSeconds={5} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Riwayat login, perubahan data pegawai, master data, dan akses HR Admin.
        Default menampilkan aktivitas hari ini saja (maks. 300 baris).
      </p>
      <ActivityLogTable
        logs={logs}
        dateFilter={
          <ActivityLogDateFilter key="activity-log-date-filter" initialFrom={dari} initialTo={sampai} />
        }
      />
    </div>
  )
}
