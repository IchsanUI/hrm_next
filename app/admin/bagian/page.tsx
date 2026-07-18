import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { DepartmentsTable } from "@/components/departments-table"

export default async function BagianPage() {
  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      include: { headEmployee: { select: { fullName: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { isDeleted: false },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ])

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Data Bagian" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Data Bagian</h1>
      <DepartmentsTable departments={departments} employees={employees} />
    </div>
  )
}
