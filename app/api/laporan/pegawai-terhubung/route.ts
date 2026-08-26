import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// Daftar pegawai yang PIN mesin fingerprint-nya sudah dipetakan (lihat
// Employee.pinAttendance) — dipakai buat opsi filter Nama di modal Export
// Data Mentah, SENGAJA diambil dari data kepegawaian (bukan dari nilai
// `name` mentah di AttendanceLog yang bisa beda ejaan/kapital dari mesin),
// supaya satu pegawai selalu satu opsi yang konsisten.
export async function GET() {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employees = await prisma.employee.findMany({
    where: { isDeleted: false, pinAttendance: { not: null } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  })

  return NextResponse.json({ employees })
}
