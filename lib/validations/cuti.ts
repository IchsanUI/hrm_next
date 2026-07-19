import { z } from "zod"

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Durasi >3 hari (kalender) mewajibkan dokumen pendukung — dipakai di sini
// buat validasi tanggal saja, cek file-nya dilakukan terpisah di server
// action (butuh akses FormData mentah, bukan cuma field zod).
export const CUTI_DOCUMENT_REQUIRED_THRESHOLD_DAYS = 3

export function cutiDurationDays(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export const cutiRequestSchema = z
  .object({
    startDate: z.string().min(1, "Tanggal mulai cuti wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai cuti wajib diisi"),
    reason: z.string().min(1, "Alasan cuti wajib diisi"),
    // Opsional — kalau kosong, step Pegawai Pengganti otomatis dilewati.
    substituteEmployeeId: z.coerce.number().int().positive().optional().or(z.literal("")),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  })
  .refine((data) => data.startDate >= todayDateString(), {
    message: "Tanggal mulai tidak boleh di hari yang sudah lewat",
    path: ["startDate"],
  })

export const cutiRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})

export const cutiRevisionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan tidak bersedia wajib diisi"),
})

export const cutiResubmitSchema = z.object({
  newSubstituteEmployeeId: z.coerce.number().int().positive("Pilih pegawai pengganti baru"),
})
