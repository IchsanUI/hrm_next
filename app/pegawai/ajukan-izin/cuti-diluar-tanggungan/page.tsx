import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { tenureYears } from "@/lib/tenure"
import { checkUnpaidLeaveEligibility } from "@/lib/validations/unpaid-leave"
import { UnpaidLeaveRequestForm } from "@/components/unpaid-leave-request-form"

export default async function AjukanIzinCutiDiluarTanggunganPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { departmentId: true, startDate: true },
  })
  const colleagues = employee
    ? await getDepartmentColleagues(session.user.employeeId, employee.departmentId)
    : []

  const tenureYearsNow = employee ? tenureYears(employee.startDate, new Date()) : 0
  const eligibility = checkUnpaidLeaveEligibility({ tenureYearsNow })

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Cuti Di Luar Tanggungan Perusahaan</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Maksimal 3 bulan, wajib diajukan minimal 1 bulan sebelum tanggal mulai.
      </p>
      <UnpaidLeaveRequestForm
        colleagues={colleagues}
        tenureYears={tenureYearsNow}
        eligibility={eligibility}
      />
    </div>
  )
}
