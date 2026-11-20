import { prisma } from "@/lib/prisma"
import { computeAttendanceNote } from "@/lib/attendance/attendance-note"
import { SHIFT_SCHEDULE_SELECT } from "@/lib/attendance/shift-schedule"

// AttendanceLog.note (Terlambat/Pulang Cepat) dihitung SEKALI saat sync
// mesin (lib/attendance/sync.ts). Kalau Penyesuaian Jam Kerja ditambah/
// diubah/dihapus SETELAH log tanggal itu sudah tersinkron, note-nya basi —
// fungsi ini menghitung ulang log pegawai shift tersebut di rentang tanggal
// periode penyesuaian (startDate/endDate @db.Date, tengah malam UTC).
export async function recomputeAttendanceNotes(workShiftId: number, startDate: Date, endDate: Date) {
  const shift = await prisma.workShift.findUnique({ where: { id: workShiftId }, select: SHIFT_SCHEDULE_SELECT })
  if (!shift) return 0

  const employees = await prisma.employee.findMany({
    where: { workShiftId, pinAttendance: { not: null } },
    select: { pinAttendance: true },
  })
  const pins = employees.map((e) => e.pinAttendance as string)
  if (pins.length === 0) return 0

  // logTime = jam dinding lokal server → rentang dibuat dengan konstruktor lokal.
  const from = new Date(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
  const to = new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999)

  const logs = await prisma.attendanceLog.findMany({
    where: { userPin: { in: pins }, logTime: { gte: from, lte: to } },
    select: { id: true, logType: true, logTime: true, note: true },
  })

  // Kelompokkan per nilai note baru → cukup beberapa updateMany, bukan satu
  // query per baris.
  const idsByNote = new Map<string | null, number[]>()
  for (const log of logs) {
    const note = computeAttendanceNote(log.logType, log.logTime, shift)
    if (note === log.note) continue
    const ids = idsByNote.get(note)
    if (ids) ids.push(log.id)
    else idsByNote.set(note, [log.id])
  }

  let changed = 0
  for (const [note, ids] of idsByNote) {
    const result = await prisma.attendanceLog.updateMany({ where: { id: { in: ids } }, data: { note } })
    changed += result.count
  }
  return changed
}
