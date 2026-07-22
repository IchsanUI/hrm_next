import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import { getHolidayExclusionSet } from "@/lib/leave-balance"
import { Breadcrumb } from "@/components/breadcrumb"
import { DispensationRequestForm } from "@/components/dispensation-request-form"

export default async function AjukanIzinDispensasiPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }

  const currentYear = new Date().getFullYear()

  const [employee, excludedDates] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { departmentId: true },
    }),
    getHolidayExclusionSet(currentYear - 1, currentYear + 1),
  ])
  const colleagues = employee
    ? await getDepartmentColleagues(session.user.employeeId, employee.departmentId)
    : []

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Dispensasi" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Dispensasi</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pilih kategori dispensasi dan isi tanggal terkait.
      </p>
      <DispensationRequestForm
        colleagues={colleagues}
        excludedDates={Array.from(excludedDates)}
      />
    </div>
  )
}
