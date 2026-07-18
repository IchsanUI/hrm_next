import Link from "next/link"

import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/breadcrumb"
import { EmployeesTable } from "@/components/employees-table"

export default async function AdminPegawaiPage() {
  const employees = await prisma.employee.findMany({
    where: { isDeleted: false },
    include: { department: true, position: true, employmentStatus: true },
    orderBy: { fullName: "asc" },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Data Pegawai" },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Data Pegawai</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/pegawai/terhapus" />}
          >
            Data Terhapus
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/admin/pegawai/baru" />}
          >
            Tambah Pegawai
          </Button>
        </div>
      </div>
      <EmployeesTable employees={employees} />
    </div>
  )
}
