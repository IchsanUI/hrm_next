import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { SickLeaveRequestForm } from "@/components/sick-leave-request-form"

export default async function AjukanIzinSakitPage() {
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
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Sakit</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi tanggal dan alasan sakit Anda.
      </p>
      <SickLeaveRequestForm colleagues={colleagues} />
    </div>
  )
}
