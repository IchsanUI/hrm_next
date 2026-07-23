import { prisma } from "@/lib/prisma"

// Query lengkap dipakai bareng oleh Profil Saya (admin & pegawai) — semua
// relasi yang ditampilkan EmployeeProfileView, sama seperti detail pegawai
// versi admin tapi read-only.
export function getFullEmployeeProfile(employeeId: number) {
  return prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: true,
      position: true,
      workLocation: true,
      employmentStatus: true,
      workShift: true,
      salaryGrade: true,
      reportsTo: {
        select: { fullName: true, position: { select: { name: true } } },
      },
      spouse: true,
      children: { orderBy: { birthDate: "asc" } },
      workHistories: { orderBy: { date: "desc" } },
      trainings: { orderBy: { date: "desc" } },
      achievements: { orderBy: { date: "desc" } },
      rewardsPunishments: { orderBy: { date: "desc" } },
      mutations: { orderBy: { date: "desc" } },
      assignmentLetters: { orderBy: { date: "desc" } },
    },
  })
}

export type FullEmployeeProfile = NonNullable<
  Awaited<ReturnType<typeof getFullEmployeeProfile>>
>
