import { z } from "zod"

export const lateArrivalRequestSchema = z.object({
  reason: z.string().min(1, "Alasan keterlambatan wajib diisi"),
})

export const lateArrivalRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
