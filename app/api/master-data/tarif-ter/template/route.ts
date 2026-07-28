import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildTerRateImportTemplateWorkbook } from "@/lib/reports/ter-rate-import-template"

export async function GET() {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workbook = await buildTerRateImportTemplateWorkbook()
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template Import Tarif TER.xlsx"',
    },
  })
}
