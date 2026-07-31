import { z } from "zod"
import { requiredCoordinateSchema } from "@/lib/validations/geo"

// Dipakai form (CameraCaptureInput maxFiles) & server action (validasi
// ulang) — batas jaga-jaga supaya body server action tidak nabrak limit
// ukuran (lihat experimental.serverActions.bodySizeLimit di next.config.ts)
// walau tiap foto sudah dikompres di browser.
export const MAX_OVERTIME_PROOF_FILES = 5

export const overtimeRequestSchema = z
  .object({
    date: z.string().min(1, "Tanggal lembur wajib diisi"),
    task: z.string().min(1, "Tugas lembur wajib diisi"),
    // Lokasi WAJIB — pegawai harus mengizinkan akses lokasi browser dulu
    // sebelum bisa mengajukan (lihat components/location-required-field.tsx).
    locationLat: requiredCoordinateSchema(-90, 90),
    locationLng: requiredCoordinateSchema(-180, 180),
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
