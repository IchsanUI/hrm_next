import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buildEmployeeFullReportWorkbook } from "@/lib/reports/employee-full-report"

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
      workShift: true,
      reportsTo: { select: { fullName: true, position: { select: { name: true } } } },
      spouse: true,
      children: true,
      workHistories: true,
      trainings: true,
      achievements: true,
      rewardsPunishments: true,
      mutations: true,
      assignmentLetters: true,
    },
    orderBy: { fullName: "asc" },
  })

  const workbook = await buildEmployeeFullReportWorkbook(employees)
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Data Pegawai Full.xlsx"',
    },
  })
}
