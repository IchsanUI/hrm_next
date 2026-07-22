import { z } from "zod"

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const offSiteAttendanceRequestSchema = z
  .object({
    date: z.string().min(1, "Tanggal wajib diisi"),
    location: z.string().min(1, "Lokasi kerja di luar kantor wajib diisi"),
    reason: z.string().min(1, "Keperluan wajib diisi"),
    locationLat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
    locationLng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  })
  .refine((data) => data.date >= todayDateString(), {
    message: "Tanggal tidak boleh di hari yang sudah lewat",
    path: ["date"],
  })

export const offSiteAttendanceRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
