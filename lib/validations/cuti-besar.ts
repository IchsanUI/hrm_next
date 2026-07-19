import { z } from "zod"

export { tenureYears } from "@/lib/tenure"

// Pasal 38: total 2 bulan, diambil sebagai 2 pengajuan terpisah, masing-
// masing tetap 1 bulan (tahun ke-7 & ke-8 masa kerja).
export const CUTI_BESAR_MAX_INSTALLMENTS = 2
export const CUTI_BESAR_MIN_TENURE_FIRST_YEARS = 6 // syarat pengajuan ke-1 (masuk tahun ke-7)
export const CUTI_BESAR_MIN_TENURE_SECOND_YEARS = 7 // syarat pengajuan ke-2 (masuk tahun ke-8)

// "Jendela normal" tiap pengajuan cuma sampai SEBELUM angka ini — dipakai
// buat penanda "Terlambat" saja (informasi buat HR/approver), BUKAN buat
// memblokir. Pasal 38 tidak menyebutkan hak ini hangus kalau lewat tahun
// ke-7/ke-8, jadi pengajuan tetap diizinkan, cuma ditandai.
export const CUTI_BESAR_FIRST_LATE_THRESHOLD_YEARS = 7 // pengajuan ke-1 telat kalau masa kerja >=7 tahun
export const CUTI_BESAR_SECOND_LATE_THRESHOLD_YEARS = 8 // pengajuan ke-2 telat kalau masa kerja >=8 tahun

export function isCutiBesarLate(installmentNumber: 1 | 2, tenureYearsAtSubmission: number): boolean {
  const threshold =
    installmentNumber === 1
      ? CUTI_BESAR_FIRST_LATE_THRESHOLD_YEARS
      : CUTI_BESAR_SECOND_LATE_THRESHOLD_YEARS
  return tenureYearsAtSubmission >= threshold
}

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Tanggal selesai = tanggal mulai + 1 bulan - 1 hari (kalender), otomatis —
// pemohon cuma perlu pilih tanggal mulai.
export function computeCutiBesarEndDate(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  end.setUTCDate(end.getUTCDate() - 1)
  return end.toISOString().slice(0, 10)
}

export type CutiBesarEligibility = { eligible: true } | { eligible: false; reason: string }

// Satu-satunya sumber kebenaran syarat pengajuan (dipakai form & server
// action) — supaya pesan yang ditampilkan ke pemohon SAMA PERSIS dengan
// yang benar-benar divalidasi server, tidak ada drift.
export function checkCutiBesarEligibility(params: {
  installmentsUsed: number
  tenureYearsNow: number
  firstInstallmentApproved: boolean
  hasException: boolean
}): CutiBesarEligibility {
  const { installmentsUsed, tenureYearsNow, firstInstallmentApproved, hasException } = params

  if (installmentsUsed >= CUTI_BESAR_MAX_INSTALLMENTS && !hasException) {
    return {
      eligible: false,
      reason: `Anda sudah mencapai batas ${CUTI_BESAR_MAX_INSTALLMENTS}x Cuti Besar seumur bekerja (Pasal 38). Hubungi HR/Admin kalau ini pengecualian.`,
    }
  }

  if (installmentsUsed === 0) {
    if (tenureYearsNow < CUTI_BESAR_MIN_TENURE_FIRST_YEARS) {
      const remaining = CUTI_BESAR_MIN_TENURE_FIRST_YEARS - tenureYearsNow
      return {
        eligible: false,
        reason: `Cuti Besar pertama baru bisa diajukan setelah masa kerja mencapai ${CUTI_BESAR_MIN_TENURE_FIRST_YEARS} tahun terus-menerus (Pasal 38). Masa kerja Anda saat ini ${tenureYearsNow} tahun — kurang ${remaining} tahun lagi.`,
      }
    }
    return { eligible: true }
  }

  if (installmentsUsed === 1) {
    if (tenureYearsNow < CUTI_BESAR_MIN_TENURE_SECOND_YEARS) {
      const remaining = CUTI_BESAR_MIN_TENURE_SECOND_YEARS - tenureYearsNow
      return {
        eligible: false,
        reason: `Cuti Besar kedua baru bisa diajukan setelah masa kerja mencapai ${CUTI_BESAR_MIN_TENURE_SECOND_YEARS} tahun terus-menerus (Pasal 38). Masa kerja Anda saat ini ${tenureYearsNow} tahun — kurang ${remaining} tahun lagi.`,
      }
    }
    if (!firstInstallmentApproved) {
      return {
        eligible: false,
        reason:
          "Cuti Besar pertama Anda belum disetujui — pengajuan kedua baru bisa diajukan setelah yang pertama APPROVED.",
      }
    }
    return { eligible: true }
  }

  // installmentsUsed >= 2 dengan pengecualian admin aktif.
  return { eligible: true }
}

export const cutiBesarRequestSchema = z
  .object({
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    reason: z.string().optional(),
    substituteEmployeeId: z.coerce.number().int().positive().optional().or(z.literal("")),
  })
  .refine((data) => data.startDate >= todayDateString(), {
    message: "Tanggal mulai tidak boleh di hari yang sudah lewat",
    path: ["startDate"],
  })

export const cutiBesarRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})

export const cutiBesarRevisionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan tidak bersedia wajib diisi"),
})

export const cutiBesarResubmitSchema = z.object({
  newSubstituteEmployeeId: z.coerce.number().int().positive("Pilih pegawai pengganti baru"),
})
