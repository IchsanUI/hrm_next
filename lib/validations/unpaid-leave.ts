import { z } from "zod"

import { tenureYears } from "@/lib/tenure"

// Pasal 39: syarat masa kerja >=10 tahun terus-menerus, diajukan minimal 1
// bulan sebelum tanggal mulai, durasi maksimal 3 bulan.
export const UNPAID_LEAVE_MIN_TENURE_YEARS = 10
export const UNPAID_LEAVE_MIN_NOTICE_MONTHS = 1
export const UNPAID_LEAVE_MAX_MONTHS = 3

function todayDate() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function toDateOnlyUTC(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`)
}

function addMonthsIso(date: Date, months: number) {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result.toISOString().slice(0, 10)
}

// Tanggal mulai paling cepat yang boleh dipilih hari ini — memenuhi syarat
// "diajukan selambat-lambatnya 1 bulan sebelumnya" (Pasal 39 ayat 2).
export function minUnpaidLeaveStartDate(): string {
  return addMonthsIso(todayDate(), UNPAID_LEAVE_MIN_NOTICE_MONTHS)
}

// Batas tanggal selesai terjauh dari tanggal mulai — "paling lama 3 bulan"
// (Pasal 39 ayat 1). Dikurangi 1 hari supaya inklusif (mis. mulai 1 Jan,
// batas 3 bulan jatuh di 31 Mar, bukan 1 Apr).
export function maxUnpaidLeaveEndDate(startDate: string): string {
  const start = toDateOnlyUTC(startDate)
  const capped = new Date(start)
  capped.setUTCMonth(capped.getUTCMonth() + UNPAID_LEAVE_MAX_MONTHS)
  capped.setUTCDate(capped.getUTCDate() - 1)
  return capped.toISOString().slice(0, 10)
}

export type UnpaidLeaveEligibility = { eligible: true } | { eligible: false; reason: string }

export function checkUnpaidLeaveEligibility(params: {
  tenureYearsNow: number
}): UnpaidLeaveEligibility {
  if (params.tenureYearsNow < UNPAID_LEAVE_MIN_TENURE_YEARS) {
    const remaining = UNPAID_LEAVE_MIN_TENURE_YEARS - params.tenureYearsNow
    return {
      eligible: false,
      reason: `Cuti Di Luar Tanggungan Perusahaan hanya untuk pegawai dengan masa kerja minimal ${UNPAID_LEAVE_MIN_TENURE_YEARS} tahun terus-menerus (Pasal 39). Masa kerja Anda saat ini ${params.tenureYearsNow} tahun — kurang ${remaining} tahun lagi.`,
    }
  }
  return { eligible: true }
}

export { tenureYears }

export const unpaidLeaveRequestSchema = z
  .object({
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
    reason: z.string().min(1, "Alasan wajib diisi"),
    substituteEmployeeId: z.coerce.number().int().positive().optional().or(z.literal("")),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  })
  .refine((data) => data.startDate >= minUnpaidLeaveStartDate(), {
    message: `Tanggal mulai wajib diajukan minimal ${UNPAID_LEAVE_MIN_NOTICE_MONTHS} bulan sebelumnya (Pasal 39).`,
    path: ["startDate"],
  })
  .refine((data) => data.endDate <= maxUnpaidLeaveEndDate(data.startDate), {
    message: `Durasi maksimal ${UNPAID_LEAVE_MAX_MONTHS} bulan (Pasal 39).`,
    path: ["endDate"],
  })

export const unpaidLeaveRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})

export const unpaidLeaveRevisionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan tidak bersedia wajib diisi"),
})

export const unpaidLeaveResubmitSchema = z.object({
  newSubstituteEmployeeId: z.coerce.number().int().positive("Pilih pegawai pengganti baru"),
})
