import { z } from "zod"

export const overtimeRequestSchema = z
  .object({
    date: z.string().min(1, "Tanggal lembur wajib diisi"),
    task: z.string().min(1, "Tugas lembur wajib diisi"),
    // Lokasi opsional — kalau browser menolak izin lokasi, pengajuan tetap jalan.
    locationLat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
    locationLng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      const inputDate = new Date(`${data.date}T00:00:00`)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return inputDate >= today
    },
    { message: "Tanggal lembur tidak boleh di hari yang sudah lewat", path: ["date"] }
  )

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

export const overtimeCompletionSchema = z
  .object({
    actualStartTime: z
      .string()
      .regex(timePattern, "Jam mulai lembur wajib diisi"),
    actualEndTime: z.string().regex(timePattern, "Jam selesai lembur wajib diisi"),
    resultDescription: z.string().min(1, "Deskripsi hasil lembur wajib diisi"),
  })
  .refine(
    (data) => data.actualStartTime !== data.actualEndTime,
    {
      message: "Jam mulai dan jam selesai tidak boleh sama",
      path: ["actualEndTime"],
    }
  )

export const overtimeRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
