import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildAttendanceKpiWorkbook, resolveMonthRange } from "@/lib/reports/attendance-kpi-report"

export async function GET(request: Request) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bulan = new URL(request.url).searchParams.get("bulan")
  const range = resolveMonthRange(bulan)

  const workbook = await buildAttendanceKpiWorkbook(range)
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap Absen KPI - ${range.label}.xlsx"`,
    },
  })
}
