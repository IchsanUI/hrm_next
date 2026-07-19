// Murni tanggal, tidak import prisma — dipakai lintas fitur (Cuti Besar
// Pasal 38, Cuti Di Luar Tanggungan Pasal 39) yang mensyaratkan masa kerja
// minimum terus-menerus.

// Selisih tahun masa kerja terus-menerus, dibulatkan ke bawah (mis. 9 tahun
// 11 bulan dihitung 9, belum 10).
export function tenureYears(employeeStartDate: Date, asOf: Date): number {
  let years = asOf.getUTCFullYear() - employeeStartDate.getUTCFullYear()
  const anniversaryPassed =
    asOf.getUTCMonth() > employeeStartDate.getUTCMonth() ||
    (asOf.getUTCMonth() === employeeStartDate.getUTCMonth() &&
      asOf.getUTCDate() >= employeeStartDate.getUTCDate())
  if (!anniversaryPassed) years -= 1
  return Math.max(0, years)
}
