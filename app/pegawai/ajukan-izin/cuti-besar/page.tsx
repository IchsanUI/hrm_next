import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { tenureYears, checkCutiBesarEligibility } from "@/lib/validations/cuti-besar"
import { CutiBesarRequestForm } from "@/components/cuti-besar-request-form"

export default async function AjukanIzinCutiBesarPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { departmentId: true, startDate: true, allowCutiBesarException: true },
  })
  const colleagues = employee
    ? await getDepartmentColleagues(session.user.employeeId, employee.departmentId)
    : []

  const priorRequests = await prisma.cutiBesarRequest.findMany({
    where: {
      employeeId: session.user.employeeId,
      status: { in: ["PENDING_APPROVAL", "REVISI", "APPROVED"] },
    },
    select: { status: true },
  })
  const installmentsUsed = priorRequests.length
  const tenureYearsNow = employee ? tenureYears(employee.startDate, new Date()) : 0

  const eligibility = checkCutiBesarEligibility({
    installmentsUsed,
    tenureYearsNow,
    firstInstallmentApproved: priorRequests.some((r) => r.status === "APPROVED"),
    hasException: employee?.allowCutiBesarException ?? false,
  })

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Cuti Besar</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi tanggal mulai — tanggal selesai dihitung otomatis 1 bulan.
      </p>
      <CutiBesarRequestForm
        colleagues={colleagues}
        tenureYears={tenureYearsNow}
        installmentsUsed={installmentsUsed}
        eligibility={eligibility}
      />
    </div>
  )
}
