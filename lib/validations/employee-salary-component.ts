import { z } from "zod"

export const employeeSalaryComponentSchema = z.object({
  salaryComponentId: z.coerce.number().int().positive("Komponen gaji wajib dipilih"),
  amount: z.coerce.number().nonnegative().optional().or(z.literal("")),
})

export type EmployeeSalaryComponentFormValues = z.infer<typeof employeeSalaryComponentSchema>
