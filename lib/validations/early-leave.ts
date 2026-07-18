import { z } from "zod"

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

export const earlyLeaveRequestSchema = z.object({
  plannedLeaveTime: z.string().regex(timePattern, "Rencana jam pulang cepat wajib diisi"),
  detail: z.string().min(1, "Detail keperluan wajib diisi"),
})

export const earlyLeaveRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
