import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import {
  getIzinMonitoringRows,
  IZIN_MONITORING_KIND_OPTIONS,
  type IzinMonitoringRow,
} from "@/lib/izin-monitoring"
import { buildIzinMonitoringWorkbook } from "@/lib/reports/izin-monitoring-report"

type IzinKind = IzinMonitoringRow["kind"]

const KIND_LABEL = new Map<IzinKind, string>(
  IZIN_MONITORING_KIND_OPTIONS.map((o) => [o.value, o.label])
)

function parseDateParam(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  return new Date(`${value}T00:00:00`)
}

export async function GET(request: Request) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const startDate = parseDateParam(url.searchParams.get("dari"), firstOfMonth)
  const endDateParam = parseDateParam(url.searchParams.get("sampai"), today)
  const endDate = new Date(endDateParam)
  endDate.setHours(23, 59, 59, 999)

  const kindParam = url.searchParams.get("jenis") as IzinKind | null
  const kind = kindParam && KIND_LABEL.has(kindParam) ? kindParam : undefined

  const rows = await getIzinMonitoringRows({ startDate, endDate, kind })

  const formatLabel = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
  const rangeLabel = `${kind ? KIND_LABEL.get(kind) + " — " : ""}${formatLabel(startDate)} s.d. ${formatLabel(endDate)}`

  const workbook = await buildIzinMonitoringWorkbook(rows, rangeLabel)
  const buffer = await workbook.xlsx.writeBuffer()

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${session.user.username} mengunduh laporan Monitoring Izin (${rangeLabel}).`,
  })

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Monitoring Izin - ${rangeLabel}.xlsx"`,
    },
  })
}
