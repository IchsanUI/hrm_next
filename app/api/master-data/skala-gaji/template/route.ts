import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildSalaryGradeRateImportTemplateWorkbook } from "@/lib/reports/salary-grade-rate-import-template"

export async function GET() {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workbook = await buildSalaryGradeRateImportTemplateWorkbook()
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template Import Tabel Gaji Pokok.xlsx"',
    },
  })
}
