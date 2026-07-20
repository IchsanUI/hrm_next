import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { resolveMonthRange } from "@/lib/reports/attendance-kpi-report"
import { buildOvertimeReportWorkbook } from "@/lib/reports/overtime-report"

export async function GET(request: Request) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const bulan = url.searchParams.get("bulan")
  const range = resolveMonthRange(bulan)

  const workbook = await buildOvertimeReportWorkbook(range, url.origin)
  const buffer = await workbook.xlsx.writeBuffer()

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${session.user.username} mengunduh laporan Rekap Lembur (${range.label}).`,
  })

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap Lembur - ${range.label}.xlsx"`,
    },
  })
}
