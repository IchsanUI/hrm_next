import { prisma } from "@/lib/prisma"
import { LEAVE_TYPES } from "@/lib/leave-types"
import type { IzinTypeSettingRow } from "@/lib/izin-type-settings-constants"

export type { IzinTypeSettingRow }

// Baris yang belum pernah diatur admin dianggap default: aktif, tanpa batas
// jam, tanpa batas bulanan — supaya menambah jenis izin baru di
// lib/leave-types.ts tidak perlu migrasi data tambahan.
function defaultSetting(leaveType: string): IzinTypeSettingRow {
  return { leaveType, isActive: true, submissionCutoffTime: null, submissionLimitPerMonth: null }
}

// Dipakai halaman Pengaturan Izin — satu baris per entri LEAVE_TYPES,
// digabung dengan data tersimpan (kalau ada).
export async function getIzinTypeSettings(): Promise<IzinTypeSettingRow[]> {
  const rows = await prisma.izinTypeSetting.findMany()
  const byLeaveType = new Map(rows.map((r) => [r.leaveType, r]))
  return LEAVE_TYPES.map((t) => byLeaveType.get(t.value) ?? defaultSetting(t.value))
}

function parseCutoffToday(cutoff: string, now: Date): Date {
  const [h, m] = cutoff.split(":").map(Number)
  const result = new Date(now)
  result.setHours(h, m, 0, 0)
  return result
}

// Hitung berapa kali pegawai ini SUDAH mengajukan tipe izin ini di bulan
// kalender `now` (dihitung dari createdAt, semua status — termasuk yang
// masih PENDING/ditolak — biar batasnya soal "berapa kali mengajukan",
// bukan "berapa kali disetujui"). Cuma didukung buat jenis izin yang
// modelnya sudah dipetakan di sini — lihat IZIN_TYPES_WITH_MONTHLY_LIMIT.
async function countSubmissionsThisMonth(
  leaveType: string,
  employeeId: number,
  now: Date
): Promise<number | null> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const createdAtThisMonth = { employeeId, createdAt: { gte: monthStart, lte: monthEnd } }

  switch (leaveType) {
    case "IZIN_ABSEN_LUAR_KANTOR":
      return prisma.offSiteAttendanceRequest.count({ where: createdAtThisMonth })
    case "IZIN_TIDAK_ABSEN":
      return prisma.attendanceStatementRequest.count({ where: createdAtThisMonth })
    default:
      return null // belum ada mapping model — batasnya diam-diam tidak ditegakkan
  }
}

// Dipanggil dari tiap createXxxRequestAction sebelum insert — null berarti
// boleh lanjut, string berarti alasan kenapa pengajuan harus ditolak.
export async function getIzinTypeBlockReason(
  leaveType: string,
  employeeId: number,
  now: Date = new Date()
): Promise<string | null> {
  const setting = await prisma.izinTypeSetting.findUnique({ where: { leaveType } })
  if (!setting) return null

  if (!setting.isActive) {
    return "Jenis izin ini sedang dinonaktifkan oleh Admin. Hubungi HR/Admin untuk informasi lebih lanjut."
  }

  if (setting.submissionCutoffTime) {
    const cutoff = parseCutoffToday(setting.submissionCutoffTime, now)
    if (now.getTime() > cutoff.getTime()) {
      return `Batas pengajuan hari ini sudah lewat pukul ${setting.submissionCutoffTime}. Silakan ajukan lagi besok.`
    }
  }

  if (setting.submissionLimitPerMonth !== null) {
    const usedCount = await countSubmissionsThisMonth(leaveType, employeeId, now)
    if (usedCount !== null && usedCount >= setting.submissionLimitPerMonth) {
      return `Batas pengajuan jenis izin ini sudah tercapai (maks. ${setting.submissionLimitPerMonth}x per bulan). Silakan ajukan lagi bulan depan atau hubungi HR/Admin.`
    }
  }

  return null
}
