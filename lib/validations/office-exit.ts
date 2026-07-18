import { z } from "zod"

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

export const officeExitRequestSchema = z.object({
  plannedExitTime: z.string().regex(timePattern, "Rencana jam keluar wajib diisi"),
  category: z.enum(["PRIBADI", "DINAS"], { message: "Kategori wajib dipilih" }),
  reason: z.string().min(1, "Penjelasan keluar wajib diisi"),
})

export const officeExitRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
