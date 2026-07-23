import { notFound } from "next/navigation"
import Link from "next/link"

import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PayrollPeriodActions } from "@/components/payroll-period-actions"
import { PayslipListTable, type PayslipRow, type ManualComponent } from "@/components/payslip-list-table"
import { getLeaveSummaryByEmployee } from "@/lib/attendance/leave-summary"

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

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function PayrollPeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const periodId = Number(id)

  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
  if (!period) {
    notFound()
  }

  const [payslips, manualComponentRows, manualEntryRows, activeVersion] = await Promise.all([
    prisma.payslip.findMany({
      where: { payrollPeriodId: periodId },
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
      orderBy: { employee: { fullName: "asc" } },
    }),
    prisma.salaryComponent.findMany({
      where: { isActive: true, calculationType: "MANUAL_PERIODE" },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.payrollManualEntry.findMany({ where: { payrollPeriodId: periodId } }),
    prisma.salaryScaleVersion.findFirst({ where: { isActive: true }, select: { name: true } }),
  ])

  const manualComponents: ManualComponent[] = manualComponentRows.map((c) => ({ id: c.id, name: c.name }))

  const manualEntriesByEmployee = new Map<number, Record<number, number>>()
  for (const entry of manualEntryRows) {
    const record = manualEntriesByEmployee.get(entry.employeeId) ?? {}
    record[entry.salaryComponentId] = entry.amount
    manualEntriesByEmployee.set(entry.employeeId, record)
  }

  const leaveSummaryByEmployee = await getLeaveSummaryByEmployee(
    payslips.map((p) => p.employeeId),
    period.periodStart,
    period.periodEnd
  )

  const rows: PayslipRow[] = payslips.map((p) => ({
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
    manualEntries: manualEntriesByEmployee.get(p.employeeId) ?? {},
    leaveSummary: leaveSummaryByEmployee.get(p.employeeId) ?? { cuti: 0, sakit: 0, dispensasiSppd: 0 },
  }))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Proses Payroll", href: "/admin/payroll/proses" },
          { label: `${MONTH_NAMES[period.month - 1]} ${period.year}` },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Payroll {MONTH_NAMES[period.month - 1]} {period.year}
            <Badge variant={period.status === "LOCKED" ? "default" : "outline"}>
              {period.status === "LOCKED" ? "Dikunci" : "Draft"}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Cut-off {formatDate(period.periodStart)} — {formatDate(period.periodEnd)}
            {period.status === "LOCKED" && period.lockedAt
              ? ` · Dikunci ${formatDate(period.lockedAt)} oleh ${period.lockedBy ?? "-"}`
              : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/payroll/proses" />}
            nativeButton={false}
          >
            Kembali
          </Button>
          <PayrollPeriodActions periodId={period.id} status={period.status} />
        </div>
      </div>

      <PayslipListTable
        payslips={rows}
        periodId={period.id}
        manualComponents={manualComponents}
        isLocked={period.status === "LOCKED"}
      />
    </div>
  )
}
