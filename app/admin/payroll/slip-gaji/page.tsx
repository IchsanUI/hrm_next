import { prisma } from "@/lib/prisma"
import { getLeaveSummaryByEmployee } from "@/lib/attendance/leave-summary"
import { Breadcrumb } from "@/components/breadcrumb"
import { EmployeePayslipBrowser, type PayslipBrowserRow } from "@/components/employee-payslip-browser"
import { PayrollYearFilter } from "@/components/payroll-year-filter"

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

export default async function SlipGajiPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string }>
}) {
  const params = await searchParams
  const currentYear = new Date().getFullYear()

  const distinctYears = await prisma.payrollPeriod.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  })
  const years = distinctYears.length > 0 ? distinctYears.map((y) => y.year) : [currentYear]
  const selectedYear = params.tahun && years.includes(Number(params.tahun)) ? Number(params.tahun) : years[0]

  const [periods, activeVersion] = await Promise.all([
    prisma.payrollPeriod.findMany({
      where: { year: selectedYear },
      orderBy: { month: "desc" },
    }),
    prisma.salaryScaleVersion.findFirst({ where: { isActive: true }, select: { name: true } }),
  ])
  const periodIds = periods.map((p) => p.id)
  const periodsById = new Map(periods.map((p) => [p.id, p]))

  const payslips =
    periodIds.length > 0
      ? await prisma.payslip.findMany({
          where: { payrollPeriodId: { in: periodIds } },
          include: {
            employee: {
              select: {
                fullName: true,
                employeeNumber: true,
                salaryGradeStep: true,
                salaryGrade: { select: { code: true, subGrade: true } },
              },
            },
            items: { orderBy: { id: "asc" } },
          },
          orderBy: [{ payrollPeriodId: "desc" }, { employee: { fullName: "asc" } }],
        })
      : []

  // Rekap izin (Cuti/Sakit/Dispensasi) buat ditampilkan di dialog detail —
  // dihitung PER PERIODE (rentang tanggalnya beda-beda), jadi query-nya
  // dikelompokkan per periode dulu (bukan satu query gabungan semua periode
  // sekaligus, karena rentang cuti relevan cuma dalam satu periode).
  const leaveSummaryByKey = new Map<string, { cuti: number; sakit: number; dispensasiSppd: number }>()
  for (const periodId of periodIds) {
    const period = periodsById.get(periodId)
    if (!period) continue
    const employeeIdsInPeriod = payslips.filter((p) => p.payrollPeriodId === periodId).map((p) => p.employeeId)
    if (employeeIdsInPeriod.length === 0) continue
    const summary = await getLeaveSummaryByEmployee(employeeIdsInPeriod, period.periodStart, period.periodEnd)
    for (const [employeeId, s] of summary) {
      leaveSummaryByKey.set(`${employeeId}-${periodId}`, s)
    }
  }

  const rows: PayslipBrowserRow[] = payslips.map((p) => {
    const period = periodsById.get(p.payrollPeriodId)
    return {
      id: p.id,
      employeeId: p.employeeId,
      employeeName: p.employee.fullName,
      employeeNumber: p.employee.employeeNumber,
      golongan: p.employee.salaryGrade
        ? `${p.employee.salaryGrade.code}-${p.employee.salaryGrade.subGrade}${
            p.employee.salaryGradeStep !== null ? `/${p.employee.salaryGradeStep}` : ""
          }`
        : null,
      salaryScaleVersionName: activeVersion?.name ?? null,
      gajiPokok: p.items[0]?.amount ?? 0,
      grossPay: p.grossPay,
      totalDeduction: p.totalDeduction,
      pph21: p.pph21,
      netPay: p.netPay,
      items: p.items.map((item) => ({
        name: item.name,
        detail: item.detail,
        category: item.category,
        amount: item.amount,
      })),
      manualEntries: {},
      leaveSummary: leaveSummaryByKey.get(`${p.employeeId}-${p.payrollPeriodId}`) ?? {
        cuti: 0,
        sakit: 0,
        dispensasiSppd: 0,
      },
      periodId: p.payrollPeriodId,
      periodLabel: period ? `${MONTH_NAMES[period.month - 1]} ${period.year}` : "-",
      periodStatus: period?.status ?? "DRAFT",
    }
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Slip Gaji Pegawai" },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Slip Gaji Pegawai</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat slip gaji semua pegawai yang sudah diproses, lintas periode.
          </p>
        </div>
        <PayrollYearFilter years={years} selectedYear={selectedYear} />
      </div>

      <EmployeePayslipBrowser rows={rows} />
    </div>
  )
}
