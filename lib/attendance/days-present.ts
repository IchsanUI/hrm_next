import { prisma } from "@/lib/prisma"

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// Jumlah hari hadir per pegawai (by pinAttendance) dalam satu rentang
// tanggal — 1 hari dianggap hadir kalau ada MINIMAL SATU log tap
// (Check-In/Check-Out/OT-In/OT-Out, tidak dibedakan) di tanggal itu. Logika
// ini SAMA dengan lib/reports/attendance-report.ts (Laporan Kehadiran) —
// jangan diubah salah satu tanpa yang lain supaya angkanya tetap konsisten
// di semua tempat yang menghitung "hari hadir" (laporan & Tunjangan
// Kehadiran di Proses Payroll).
export async function getAttendanceDaysByPin(
  pins: string[],
  start: Date,
  end: Date
): Promise<Map<string, number>> {
  if (pins.length === 0) return new Map()

  const logs = await prisma.attendanceLog.findMany({
    where: { userPin: { in: pins }, logTime: { gte: start, lte: end } },
    select: { userPin: true, logTime: true },
  })

  const datesByPin = new Map<string, Set<string>>()
  for (const log of logs) {
    const set = datesByPin.get(log.userPin) ?? new Set<string>()
    set.add(dateKey(log.logTime))
    datesByPin.set(log.userPin, set)
  }

  return new Map(Array.from(datesByPin.entries()).map(([pin, dates]) => [pin, dates.size]))
}
