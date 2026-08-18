import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { buildPayrollImportTemplateWorkbook } from "@/lib/reports/payroll-import-template"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const payrollPeriodId = Number(id)
  if (!Number.isInteger(payrollPeriodId)) {
    return NextResponse.json({ error: "ID periode tidak valid." }, { status: 400 })
  }

  const result = await buildPayrollImportTemplateWorkbook(payrollPeriodId)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  const buffer = await result.workbook.xlsx.writeBuffer()

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "PayrollPeriod",
    description: `${session.user.username} mengunduh template import payroll (${result.periodLabel}).`,
  })

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Template Import Payroll - ${result.periodLabel}.xlsx"`,
    },
  })
}
