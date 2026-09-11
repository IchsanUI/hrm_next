import { notFound } from "next/navigation"
import Link from "next/link"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PayrollPeriodActions } from "@/components/payroll-period-actions"
import { PayslipListTable, type PayslipRow, type ManualComponent } from "@/components/payslip-list-table"
import { getLeaveSummaryByEmployee } from "@/lib/attendance/leave-summary"
import { MONTH_NAMES } from "@/lib/month-names"
import { PAYROLL_STATUS_LABEL, PAYROLL_STATUS_BADGE_VARIANT } from "@/lib/payroll/status-labels"

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

  const [session, period] = await Promise.all([
    auth(),
    prisma.payrollPeriod.findUnique({ where: { id: periodId } }),
  ])
  if (!period) {
    notFound()
  }
  const role = session?.user.role ?? "EMPLOYEE"

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
      // MANUAL_PERIODE = nilai diisi penuh manual. KEHADIRAN+POTONGAN (mis.
      // "Pot. Kehadiran/Punishment") = nilai manual di sini DITAMBAHKAN ke
      // potongan otomatis dari data absensi, lihat lib/payroll/calculate.ts.
      where: {
        isActive: true,
        OR: [{ calculationType: "MANUAL_PERIODE" }, { calculationType: "KEHADIRAN", category: "POTONGAN" }],
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.payrollManualEntry.findMany({ where: { payrollPeriodId: periodId } }),
    prisma.salaryScaleVersion.findFirst({ where: { isActive: true }, select: { name: true } }),
  ])

  const manualComponents: ManualComponent[] = manualComponentRows.map((c) => ({
    id: c.id,
    name: c.name,
    isAdditive: c.calculationType === "KEHADIRAN" && c.category === "POTONGAN",
  }))

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
            <Badge variant={PAYROLL_STATUS_BADGE_VARIANT[period.status]}>{PAYROLL_STATUS_LABEL[period.status]}</Badge>
            {/* Jejak integritas data — dibuat menonjol di samping status,
                bukan disembunyikan di log, supaya periode yang berkali-kali
                direvisi setelah terbit (atau dikunci lewat override darurat)
                langsung kelihatan saat ditinjau/diaudit. */}
            {period.correctionCount > 0 ? (
              <Badge variant="outline">Dikoreksi {period.correctionCount}×</Badge>
            ) : null}
            {period.overrideCount > 0 ? (
              <Badge variant="destructive">Override darurat {period.overrideCount}×</Badge>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            Cut-off {formatDate(period.periodStart)} — {formatDate(period.periodEnd)}
            {period.status === "PENDING_APPROVAL" && period.submittedForApprovalAt
              ? ` · Diajukan ${formatDate(period.submittedForApprovalAt)} oleh ${period.submittedForApprovalBy ?? "-"}`
              : null}
            {period.status === "LOCKED" && period.lockedAt
              ? ` · Dikunci ${formatDate(period.lockedAt)} oleh ${period.lockedBy ?? "-"}`
              : null}
          </p>
          {period.status === "DRAFT" && period.rejectionReason ? (
            <p className="mt-1 text-sm text-destructive">
              Ditolak: {period.rejectionReason}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/payroll/proses" />}
            nativeButton={false}
          >
            Kembali
          </Button>
          <PayrollPeriodActions periodId={period.id} status={period.status} role={role} />
        </div>
      </div>

      <PayslipListTable
        payslips={rows}
        periodId={period.id}
        manualComponents={manualComponents}
        isLocked={period.status !== "DRAFT"}
      />
    </div>
  )
}
