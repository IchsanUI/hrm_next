import Link from "next/link"

import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/breadcrumb"
import { DeletedEmployeesTable } from "@/components/deleted-employees-table"

export default async function DeletedPegawaiPage() {
  const employees = await prisma.employee.findMany({
    where: { isDeleted: true },
    include: { department: true, position: true },
    orderBy: { deletedAt: "desc" },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Data Pegawai", href: "/admin/pegawai" },
          { label: "Data Terhapus" },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Data Pegawai Terhapus</h1>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/admin/pegawai" />}
        >
          Kembali
        </Button>
      </div>
      <DeletedEmployeesTable employees={employees} />
    </div>
  )
}
