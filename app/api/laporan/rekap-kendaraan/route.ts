import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { resolveMonthRange } from "@/lib/reports/attendance-kpi-report"
import { buildVehicleBookingReportWorkbook } from "@/lib/reports/vehicle-booking-report"

// Rekap Kendaraan Dinas (?bulan=yyyy-MM). Dipakai halaman Laporan dan tab
// Semua Booking di Kendaraan Dinas, jadi HR_ADMIN cukup punya salah satu akses.
export async function GET(request: Request) {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "HR_ADMIN" && (user.menuAccess.includes("laporan") || user.menuAccess.includes("umum.kendaraan")))
  if (!user || !allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const range = resolveMonthRange(new URL(request.url).searchParams.get("bulan"))
  const { workbook, count } = await buildVehicleBookingReportWorkbook(range)
  const buffer = await workbook.xlsx.writeBuffer()

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${user.username} mengunduh laporan Rekap Kendaraan Dinas (${range.label}, ${count} booking).`,
  })

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap Kendaraan Dinas - ${range.label}.xlsx"`,
    },
  })
}
