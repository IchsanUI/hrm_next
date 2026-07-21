import { prisma } from "@/lib/prisma"
import { LEAVE_TYPES } from "@/lib/leave-types"
import type { IzinTypeSettingRow } from "@/lib/izin-type-settings-constants"

export type { IzinTypeSettingRow }

// Baris yang belum pernah diatur admin dianggap default: aktif, tanpa batas
// jam — supaya menambah jenis izin baru di lib/leave-types.ts tidak perlu
// migrasi data tambahan.
function defaultSetting(leaveType: string): IzinTypeSettingRow {
  return { leaveType, isActive: true, submissionCutoffTime: null }
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

// Dipanggil dari tiap createXxxRequestAction sebelum insert — null berarti
// boleh lanjut, string berarti alasan kenapa pengajuan harus ditolak.
export async function getIzinTypeBlockReason(
  leaveType: string,
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

  return null
}
