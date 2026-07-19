import { getEmployeeLeaveBalances } from "@/lib/leave-balance"
import { Breadcrumb } from "@/components/breadcrumb"
import { LeaveBalanceContent } from "@/components/leave-balance-content"

export default async function SaldoCutiPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const currentYear = new Date().getFullYear()
  const year = yearParam ? Number(yearParam) : currentYear
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const balances = await getEmployeeLeaveBalances(Number.isFinite(year) ? year : currentYear)

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Saldo Cuti Pegawai" },
        ]}
      />
      <LeaveBalanceContent
        balances={balances}
        year={Number.isFinite(year) ? year : currentYear}
        years={years}
        currentYear={currentYear}
      />
    </div>
  )
}
