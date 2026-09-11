// Nama bulan Bahasa Indonesia — sebelumnya di-copy-paste terpisah di
// lib/payroll/payslip-print.ts & components/payroll-period-table.tsx,
// disatukan di sini waktu notifikasi slip gaji (server/actions/payroll-period.ts)
// butuh label yang sama persis. SENGAJA array biasa (bukan Intl.DateTimeFormat)
// — dipakai buat label periode payroll yang cuma punya angka month/year, bukan
// objek Date.
export const MONTH_NAMES = [
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

// Label periode payroll dari kolom month (1-12) & year, mis. "Agustus 2026".
export function formatPeriodLabel(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`
}
