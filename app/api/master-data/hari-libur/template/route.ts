import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildNationalHolidayTemplateWorkbook } from "@/lib/reports/national-holiday-template"

export async function GET() {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workbook = await buildNationalHolidayTemplateWorkbook()
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template Hari Libur Nasional.xlsx"',
    },
  })
}
