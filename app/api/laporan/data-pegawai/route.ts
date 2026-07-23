import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { buildEmployeeReportWorkbook } from "@/lib/reports/employee-report"

export async function GET() {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employees = await prisma.employee.findMany({
    where: { isDeleted: false },
    include: {
      department: true,
      position: true,
      workLocation: true,
      employmentStatus: true,
      salaryGrade: true,
    },
    orderBy: { fullName: "asc" },
  })

  const workbook = await buildEmployeeReportWorkbook(employees)
  const buffer = await workbook.xlsx.writeBuffer()

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${session.user.username} mengunduh laporan Data Pegawai (${employees.length} pegawai).`,
  })

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Data Pegawai.xlsx"',
    },
  })
}
