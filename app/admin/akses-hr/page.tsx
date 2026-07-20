import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseMenuAccess } from "@/lib/hr-menu-access"
import { Breadcrumb } from "@/components/breadcrumb"
import { AccessHrTable } from "@/components/access-hr-table"

export default async function AksesHrPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const users = await prisma.user.findMany({
    where: { employeeId: { not: null }, isActive: true },
    include: {
      role: true,
      employee: {
        select: {
          fullName: true,
          employeeNumber: true,
          position: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { employee: { fullName: "asc" } },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Manajemen Akses HR" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Manajemen Akses HR</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Berikan atau cabut akses HR Admin untuk akun pegawai manapun, lintas bagian.
        Pegawai dengan akses HR Admin bisa mengelola data pegawai dan izin/cuti
        seluruh organisasi.
      </p>
      <AccessHrTable
        users={users
          .filter((u) => u.employee)
          .map((u) => ({
            id: u.id,
            fullName: u.employee!.fullName,
            employeeNumber: u.employee!.employeeNumber,
            position: u.employee!.position.name,
            department: u.employee!.department.name,
            role: u.role.name,
            menuAccess: parseMenuAccess(u.menuAccess),
          }))}
      />
    </div>
  )
}
