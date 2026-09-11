import type { PayrollPeriodStatus } from "@prisma/client"

// Label & warna badge status periode payroll — sebelumnya di-copy-paste di
// payroll-period-table.tsx, employee-payslip-browser.tsx, dan halaman detail
// Proses Payroll. Disatukan di sini waktu status PENDING_UNLOCK_APPROVAL
// ditambahkan, supaya menambah status berikutnya cukup sekali di satu tempat
// (sebelumnya status baru diam-diam terlewat di sebagian tampilan).
export const PAYROLL_STATUS_LABEL: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Menunggu Approval",
  LOCKED: "Dikunci",
  PENDING_UNLOCK_APPROVAL: "Menunggu Approval Koreksi",
}

export const PAYROLL_STATUS_BADGE_VARIANT: Record<
  PayrollPeriodStatus,
  "outline" | "secondary" | "default" | "destructive"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "secondary",
  LOCKED: "default",
  // Sengaja dibedakan dari PENDING_APPROVAL biasa — periodenya MASIH terkunci
  // & final, yang menunggu keputusan adalah permintaan membongkarnya.
  PENDING_UNLOCK_APPROVAL: "destructive",
}
