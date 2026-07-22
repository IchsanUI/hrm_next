import Link from "next/link"
import { Archive, Plus } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/breadcrumb"
import { EmployeesTable } from "@/components/employees-table"
import { EmployeeImportButton } from "@/components/employee-import-button"

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
          <EmployeeImportButton />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/pegawai/terhapus" />}
          >
            <Archive className="size-3.5" />
            Data Terhapus
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/admin/pegawai/baru" />}
          >
            <Plus className="size-3.5" />
            Tambah Pegawai
          </Button>
        </div>
      </div>
      <EmployeesTable employees={employees} />
    </div>
  )
}
