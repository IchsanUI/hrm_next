import { z } from "zod"

export const payrollPeriodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export type PayrollPeriodFormValues = z.infer<typeof payrollPeriodSchema>
