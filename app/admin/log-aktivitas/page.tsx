import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { ActivityLogTable } from "@/components/activity-log-table"
import { AutoRefresh } from "@/components/auto-refresh"

export default async function LogAktivitasPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const logs = await prisma.activityLog.findMany({
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
        Menampilkan 300 aktivitas terbaru.
      </p>
      <ActivityLogTable logs={logs} />
    </div>
  )
}
