import { z } from "zod"

export const leaveBalanceAdjustSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  quota: z.coerce.number().int().min(0, "Jatah cuti tidak boleh negatif"),
  adjustment: z.coerce.number().int(),
  note: z.string().optional(),
})
