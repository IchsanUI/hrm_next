import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { buildAttendanceSalaryWorkbook, parseBulanToYearMonth } from "@/lib/reports/attendance-salary-report"

export async function GET(request: Request) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bulan = new URL(request.url).searchParams.get("bulan")
  const yearMonth = parseBulanToYearMonth(bulan)
  if (!yearMonth) {
    return NextResponse.json({ error: "Bulan tidak valid." }, { status: 400 })
  }

  const result = await buildAttendanceSalaryWorkbook(yearMonth)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  const buffer = await result.workbook.xlsx.writeBuffer()

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${session.user.username} mengunduh laporan Data Kehadiran Pegawai (${result.periodLabel}).`,
  })

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Data Kehadiran Pegawai - ${result.periodLabel}.xlsx"`,
    },
  })
}
