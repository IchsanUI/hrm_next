import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { PayrollPeriodTable, type PayrollPeriodRow } from "@/components/payroll-period-table"

export default async function ProsesPayrollPage() {
  const periods = await prisma.payrollPeriod.findMany({
    include: { _count: { select: { payslips: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  })

  const rows: PayrollPeriodRow[] = periods.map((p) => ({
    id: p.id,
    year: p.year,
    month: p.month,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    status: p.status,
    payslipCount: p._count.payslips,
  }))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Proses Payroll" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Proses Payroll</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Buat periode payroll (selalu tanggal 21–20), generate payslip seluruh
        pegawai aktif, lalu kunci periode setelah dicek. Komponen bertipe
        Kehadiran/Manual per Periode belum dihitung otomatis di fase ini.
      </p>
      <PayrollPeriodTable periods={rows} />
    </div>
  )
}
