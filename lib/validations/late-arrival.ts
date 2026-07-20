import { z } from "zod"

export const lateArrivalRequestSchema = z.object({
  reason: z.string().min(1, "Alasan keterlambatan wajib diisi"),
  locationLat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  locationLng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
})

export const lateArrivalRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
