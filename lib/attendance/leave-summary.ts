import { prisma } from "@/lib/prisma"

export type LeaveSummary = { cuti: number; sakit: number; dispensasiSppd: number }

function overlapDays(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  const clampedStart = start < rangeStart ? rangeStart : start
  const clampedEnd = end > rangeEnd ? rangeEnd : end
  const days = Math.floor((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1
  return Math.max(0, days)
}

// Rekap jumlah hari Cuti/Sakit/Dispensasi+SPPD (yang approved) per pegawai
// dalam satu rentang periode — MURNI buat sanity-check tampilan Rincian
// Slip Gaji (memastikan angka hari hadir masuk akal), BUKAN dipakai buat
// mengurangi/menambah nominal payslip (potongan tidak hadir belum
// diimplementasikan, lihat catatan di lib/payroll/calculate.ts).
export async function getLeaveSummaryByEmployee(
  employeeIds: number[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<Map<number, LeaveSummary>> {
  const summary = new Map<number, LeaveSummary>()
  if (employeeIds.length === 0) return summary

  const where = {
    employeeId: { in: employeeIds },
    status: "APPROVED" as const,
    startDate: { lte: rangeEnd },
    endDate: { gte: rangeStart },
  }

  const [cutiRequests, sickLeaveRequests, dispensationRequests, offSiteRequests] = await Promise.all([
    prisma.cutiRequest.findMany({ where, select: { employeeId: true, startDate: true, endDate: true } }),
    prisma.sickLeaveRequest.findMany({ where, select: { employeeId: true, startDate: true, endDate: true } }),
    prisma.dispensationRequest.findMany({ where, select: { employeeId: true, startDate: true, endDate: true } }),
    prisma.offSiteAttendanceRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: "APPROVED",
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { employeeId: true },
    }),
  ])

  function ensure(employeeId: number) {
    const existing = summary.get(employeeId)
    if (existing) return existing
    const created: LeaveSummary = { cuti: 0, sakit: 0, dispensasiSppd: 0 }
    summary.set(employeeId, created)
    return created
  }

  for (const r of cutiRequests) {
    ensure(r.employeeId).cuti += overlapDays(r.startDate, r.endDate, rangeStart, rangeEnd)
  }
  for (const r of sickLeaveRequests) {
    ensure(r.employeeId).sakit += overlapDays(r.startDate, r.endDate, rangeStart, rangeEnd)
  }
  for (const r of dispensationRequests) {
    ensure(r.employeeId).dispensasiSppd += overlapDays(r.startDate, r.endDate, rangeStart, rangeEnd)
  }
  for (const r of offSiteRequests) {
    ensure(r.employeeId).dispensasiSppd += 1
  }

  return summary
}
