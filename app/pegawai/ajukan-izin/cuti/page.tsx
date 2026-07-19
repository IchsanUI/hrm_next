import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { getEmployeeLeaveBalance, getHolidaysInRange } from "@/lib/leave-balance"
import { CutiRequestForm } from "@/components/cuti-request-form"

export default async function AjukanIzinCutiPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }

  const currentYear = new Date().getFullYear()

  const [employee, balance, holidays] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { departmentId: true },
    }),
    getEmployeeLeaveBalance(session.user.employeeId, currentYear),
    getHolidaysInRange(currentYear - 1, currentYear + 1),
  ])
  const colleagues = employee
    ? await getDepartmentColleagues(session.user.employeeId, employee.departmentId)
    : []

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Cuti</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi tanggal dan alasan cuti Anda.
      </p>
      <CutiRequestForm
        colleagues={colleagues}
        remainingBalance={balance.remaining}
        balanceYear={currentYear}
        holidays={holidays}
        blockedByCutiBesar={balance.blockedByCutiBesar}
      />
    </div>
  )
}
