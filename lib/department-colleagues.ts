import { prisma } from "@/lib/prisma"

// Rekan satu departemen (di luar diri sendiri) — dipakai buat dropdown
// pilihan Pegawai Pengganti di Izin Sakit.
export async function getDepartmentColleagues(employeeId: number, departmentId: number) {
  return prisma.employee.findMany({
    where: {
      departmentId,
      id: { not: employeeId },
      isActive: true,
      isDeleted: false,
    },
    select: { id: true, fullName: true, position: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  })
}
