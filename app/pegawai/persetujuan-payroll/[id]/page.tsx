import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PayrollApprovalDecision } from "@/components/payroll-approval-decision"
import { getActiveApprovalStep, getPayrollApprovalHistory } from "@/lib/payroll/approval-flow"
import { formatPeriodLabel } from "@/lib/month-names"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    value
  )
}

// Halaman TINJAUAN penyetuju payroll — SENGAJA di bawah /pegawai/**, bukan
// /admin/**: penyetuju yang ditunjuk bisa saja pegawai biasa (mis. Direktur
// tanpa akun admin), dan proxy.ts memblokir /admin/** untuk non-admin. Semua
// data di sini READ-ONLY; tidak ada satu pun aksi yang mengubah angka payroll,
// jadi yang menyusun dan yang menyetujui tetap orang berbeda.
export default async function PersetujuanPayrollPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user.employeeId) redirect("/login")

  const periodId = Number((await params).id)
  if (!Number.isInteger(periodId)) notFound()

  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { _count: { select: { payslips: true } } },
  })
  if (!period) notFound()

  const activeStep = await getActiveApprovalStep(periodId)
  // Otorisasi berbasis "apakah Anda penyetuju periode ini", BUKAN berbasis
  // role — sekaligus menutup akses ke periode lain lewat tebak-tebakan id di
  // URL. Yang sedang giliran dapat tombol keputusan; yang pernah terlibat di
  // siklus mana pun tetap boleh melihat hasilnya (tanpa tombol).
  const isCurrentApprover = activeStep?.approverEmployeeId === session.user.employeeId
  if (!isCurrentApprover) {
    const everInvolved = await prisma.payrollApprovalStep.findFirst({
      where: { payrollPeriodId: periodId, approverEmployeeId: session.user.employeeId },
      select: { id: true },
    })
    if (!everInvolved) notFound()
  }

  const [payslips, history] = await Promise.all([
    prisma.payslip.findMany({
      where: { payrollPeriodId: periodId },
      select: {
        id: true,
        grossPay: true,
        totalDeduction: true,
        netPay: true,
        employee: { select: { fullName: true, employeeNumber: true } },
      },
      orderBy: { employee: { fullName: "asc" } },
    }),
    getPayrollApprovalHistory(periodId),
  ])

  const totals = payslips.reduce(
    (acc, p) => ({
      gross: acc.gross + Number(p.grossPay),
      deduction: acc.deduction + Number(p.totalDeduction),
      net: acc.net + Number(p.netPay),
    }),
    { gross: 0, deduction: 0, net: 0 }
  )

  const label = formatPeriodLabel(period.month, period.year)
  const stageLabel = activeStep?.stage === "UNLOCK" ? "Koreksi" : "Penguncian"

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Persetujuan Payroll" },
          { label },
        ]}
      />

      <div>
        <h1 className="mb-1 text-2xl font-semibold">Persetujuan Payroll — {label}</h1>
        <p className="text-sm text-muted-foreground">
          Periksa rincian di bawah sebelum memutuskan. Halaman ini hanya untuk meninjau; Anda tidak
          bisa mengubah angka payroll dari sini.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Periode</CardTitle>
          <CardDescription>
            {period._count.payslips} pegawai · diajukan oleh {period.submittedForApprovalBy ?? "—"}
            {period.correctionCount > 0 ? ` · sudah dikoreksi ${period.correctionCount}×` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Bruto</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.gross)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Potongan</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.deduction)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Dibayarkan</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.net)}</p>
          </div>
        </CardContent>
      </Card>

      {activeStep && isCurrentApprover ? (
        <PayrollApprovalDecision
          periodId={periodId}
          periodLabel={label}
          stageLabel={stageLabel}
          reason={period.rejectionReason}
        />
      ) : (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Tidak ada keputusan yang menunggu Anda untuk periode ini.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rincian per Pegawai</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3">NIP</th>
                  <th className="py-2 pr-3 text-right">Bruto</th>
                  <th className="py-2 pr-3 text-right">Potongan</th>
                  <th className="py-2 text-right">Diterima</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{p.employee.fullName}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.employee.employeeNumber}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(Number(p.grossPay))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatCurrency(Number(p.totalDeduction))}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatCurrency(Number(p.netPay))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Approval</CardTitle>
          <CardDescription>Siklus terbaru ditampilkan paling atas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                <Badge variant="outline">
                  {h.stage === "LOCK" ? "Penguncian" : "Koreksi"} #{h.round}
                </Badge>
                <span className="text-muted-foreground">Tahap {h.order}</span>
                <span className="font-medium">{h.approverName}</span>
                <Badge variant={h.status === "APPROVED" ? "default" : h.status === "REJECTED" ? "destructive" : "secondary"}>
                  {h.status}
                </Badge>
                {h.notes ? <span className="text-xs text-muted-foreground">— {h.notes}</span> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
