import { z } from "zod"

// Pasal 37: 1,5 bulan dibulatkan ke 45 hari kalender per sisi (menghindari
// aritmetika "tambah 1 bulan" yang ambigu di sekitar akhir bulan).
export const MATERNITY_LEAVE_HALF_MONTH_DAYS = 45

function toDateOnlyUTC(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`)
}

function addDaysUTC(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function isoDateUTC(date: Date) {
  return date.toISOString().slice(0, 10)
}

export type MaternityLeaveBreakdown = {
  referenceDate: string
  startDate: string
  endDate: string
  // Rentang "sebelum HPL" — cuma ada untuk BERSALIN, null untuk GUGUR_KANDUNGAN
  // (tidak ada fase "sebelum", cuti langsung mulai dari tanggal kejadian).
  beforeRangeStart: string | null
  beforeRangeEnd: string | null
  afterRangeStart: string
  afterRangeEnd: string
}

// Rincian rentang "sebelum"/"sesudah" HPL (atau "sesudah kejadian" untuk
// Gugur Kandungan) — dipakai buat tampilan detail yang lebih jelas daripada
// cuma "startDate — endDate" polos. HPL/tanggal kejadian sendiri sengaja
// tidak masuk salah satu rentang (biar 45+45 tidak dobel hitung hari
// pivotnya) — makanya beforeRangeEnd = HPL-1 hari, afterRangeStart = HPL+1
// hari, tapi Total Cuti tetap 91 hari (45+45+1 hari HPL itu sendiri).
export function computeMaternityLeaveBreakdown(
  type: "BERSALIN" | "GUGUR_KANDUNGAN",
  referenceDate: string
): MaternityLeaveBreakdown {
  const reference = toDateOnlyUTC(referenceDate)
  const { startDate, endDate } = computeMaternityLeaveDates(type, referenceDate)

  if (type === "BERSALIN") {
    return {
      referenceDate,
      startDate,
      endDate,
      beforeRangeStart: startDate,
      beforeRangeEnd: isoDateUTC(addDaysUTC(reference, -1)),
      afterRangeStart: isoDateUTC(addDaysUTC(reference, 1)),
      afterRangeEnd: endDate,
    }
  }

  return {
    referenceDate,
    startDate,
    endDate,
    beforeRangeStart: null,
    beforeRangeEnd: null,
    afterRangeStart: startDate,
    afterRangeEnd: endDate,
  }
}

// Bersalin: mulai = HPL - 45 hari, selesai = HPL + 45 hari (total ~3 bulan).
// Gugur Kandungan: mulai = tanggal kejadian, selesai = mulai + 45 hari.
export function computeMaternityLeaveDates(
  type: "BERSALIN" | "GUGUR_KANDUNGAN",
  referenceDate: string
): { startDate: string; endDate: string } {
  const reference = toDateOnlyUTC(referenceDate)
  if (type === "BERSALIN") {
    return {
      startDate: isoDateUTC(addDaysUTC(reference, -MATERNITY_LEAVE_HALF_MONTH_DAYS)),
      endDate: isoDateUTC(addDaysUTC(reference, MATERNITY_LEAVE_HALF_MONTH_DAYS)),
    }
  }
  return {
    startDate: referenceDate,
    endDate: isoDateUTC(addDaysUTC(reference, MATERNITY_LEAVE_HALF_MONTH_DAYS)),
  }
}

export const maternityLeaveRequestSchema = z.object({
  type: z.enum(["BERSALIN", "GUGUR_KANDUNGAN"]),
  referenceDate: z.string().min(1, "Tanggal wajib diisi"),
  reason: z.string().optional(),
  // Opsional — kalau kosong, step Pegawai Pengganti otomatis dilewati.
  substituteEmployeeId: z.coerce.number().int().positive().optional().or(z.literal("")),
})

export const maternityLeaveRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})

export const maternityLeaveRevisionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan tidak bersedia wajib diisi"),
})

export const maternityLeaveResubmitSchema = z.object({
  newSubstituteEmployeeId: z.coerce.number().int().positive("Pilih pegawai pengganti baru"),
})
