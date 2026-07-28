import { prisma } from "@/lib/prisma"
import { getLeaveSummaryByEmployee } from "@/lib/attendance/leave-summary"

export type PayslipPrintItem = {
  name: string
  detail: string | null
  category: string
  amount: number
}

export type PayslipPrintDocument = {
  payslipId: number
  slipNumber: string // nomor slip cetak — dikodekan ke QR code di pojok kanan bawah
  employeeName: string
  employeeNumber: string
  positionName: string
  departmentName: string
  employmentStatusName: string
  golongan: string | null
  paymentDateLabel: string // "25 Mei 2026" — PayrollSettings.paymentDay di bulan pembayaran periode ini
  periodRangeLabel: string // "21 Apr 2026 s/d 20 Mei 2026"
  cityDateLabel: string // "Gresik, 25 Mei 2026"
  items: PayslipPrintItem[]
  grossPay: number
  totalDeduction: number
  netPay: number
  leaveSummary: { cuti: number; sakit: number; dispensasiSppd: number }
  signerName: string | null // Kepala Departemen pemohon — sama sumbernya dengan Surat Perintah Lembur
  signerTitle: string | null
  signatureUrl: string | null
  letterheadUrl: string | null // PayrollSettings.letterheadUrl — null = PDF tampil tanpa kop surat
  watermarkText: string | null // PayrollSettings.watermarkText — null/"" = tanpa watermark
}

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

function formatDateLong(date: Date) {
  return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export async function getPayslipPrintDocument(payslipId: number): Promise<PayslipPrintDocument | null> {
  const [payslip, payrollSettings] = await Promise.all([
    prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: {
          select: {
            fullName: true,
            employeeNumber: true,
            position: { select: { name: true } },
            employmentStatus: { select: { name: true } },
            salaryGradeStep: true,
            salaryGrade: { select: { code: true, subGrade: true } },
            department: {
              select: {
                name: true,
                headEmployee: { select: { fullName: true, position: { select: { name: true } }, signatureUrl: true } },
              },
            },
          },
        },
        payrollPeriod: true,
        items: { orderBy: { id: "asc" } },
      },
    }),
    prisma.payrollSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ])
  if (!payslip) return null

  // Tanggal pembayaran ditampilkan sebagai TANGGAL TUNGGAL (bukan rentang) —
  // hari ke-`paymentDay` (Pengaturan Payroll) di bulan pembayaran periode
  // ini (payrollPeriod.month/year, BUKAN bulan cut-off mulai).
  const paymentDate = new Date(Date.UTC(payslip.payrollPeriod.year, payslip.payrollPeriod.month - 1, payrollSettings.paymentDay))
  const paymentDateLabel = formatDateLong(paymentDate)

  const headEmployee = payslip.employee.department.headEmployee

  return {
    payslipId: payslip.id,
    // Format: SLIP-{tahun}{bulan 2-digit}-{payslipId 6-digit} — unik &
    // gampang dibaca manual kalau QR code-nya tidak bisa discan.
    slipNumber: `SLIP-${payslip.payrollPeriod.year}${String(payslip.payrollPeriod.month).padStart(2, "0")}-${String(payslip.id).padStart(6, "0")}`,
    employeeName: payslip.employee.fullName,
    employeeNumber: payslip.employee.employeeNumber,
    positionName: payslip.employee.position.name,
    departmentName: payslip.employee.department.name,
    employmentStatusName: payslip.employee.employmentStatus.name,
    golongan: payslip.employee.salaryGrade
      ? `${payslip.employee.salaryGrade.code}-${payslip.employee.salaryGrade.subGrade}${
          payslip.employee.salaryGradeStep !== null ? `/${payslip.employee.salaryGradeStep}` : ""
        }`
      : null,
    paymentDateLabel,
    periodRangeLabel: `${formatDateLong(payslip.payrollPeriod.periodStart)} s/d ${formatDateLong(payslip.payrollPeriod.periodEnd)}`,
    cityDateLabel: `Gresik, ${paymentDateLabel}`,
    items: payslip.items.map((item) => ({
      name: item.name,
      detail: item.detail,
      category: item.category,
      amount: item.amount,
    })),
    grossPay: payslip.grossPay,
    totalDeduction: payslip.totalDeduction,
    netPay: payslip.netPay,
    leaveSummary: (
      await getLeaveSummaryByEmployee([payslip.employeeId], payslip.payrollPeriod.periodStart, payslip.payrollPeriod.periodEnd)
    ).get(payslip.employeeId) ?? { cuti: 0, sakit: 0, dispensasiSppd: 0 },
    signerName: headEmployee?.fullName ?? null,
    signerTitle: headEmployee ? `Kabag ${payslip.employee.department.name}` : null,
    signatureUrl: headEmployee?.signatureUrl ?? null,
    letterheadUrl: payrollSettings.letterheadUrl,
    watermarkText: payrollSettings.watermarkText,
  }
}
