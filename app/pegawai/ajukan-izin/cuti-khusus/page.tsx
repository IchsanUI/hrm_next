import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { Breadcrumb } from "@/components/breadcrumb"
import { SpecialLeaveRequestForm } from "@/components/special-leave-request-form"

export default async function AjukanIzinCutiKhususPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { departmentId: true },
  })
  const colleagues = employee
    ? await getDepartmentColleagues(session.user.employeeId, employee.departmentId)
    : []

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Cuti Khusus (Haji/Umroh)" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Cuti Khusus Haji/Umroh</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi jenis cuti dan tanggal terkait.
      </p>
      <SpecialLeaveRequestForm colleagues={colleagues} />
    </div>
  )
}
