import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildHistoryImportTemplateWorkbook } from "@/lib/employee-history-import"

// Template import data riwayat pegawai (semua pegawai, tanpa file pendukung).
// Hak akses sama dengan pengelola Data Pegawai.
export async function GET() {
  const session = await auth()
  const role = session?.user.role
  const allowed =
    role === "SUPER_ADMIN" ||
    (role === "HR_ADMIN" && session?.user.menuAccess.includes("kepegawaian.pegawai"))
  if (!session?.user || !allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workbook = await buildHistoryImportTemplateWorkbook()
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template Import Riwayat Pegawai.xlsx"',
    },
  })
}
