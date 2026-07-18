import { z } from "zod"

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const sickLeaveRequestSchema = z
  .object({
    startDate: z.string().min(1, "Tanggal mulai izin wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai izin wajib diisi"),
    reason: z.string().min(1, "Alasan/deskripsi sakit wajib diisi"),
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

export const sickLeaveRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})

export const sickLeaveRevisionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan tidak bersedia wajib diisi"),
})

export const sickLeaveResubmitSchema = z.object({
  newSubstituteEmployeeId: z.coerce.number().int().positive("Pilih pegawai pengganti baru"),
})
