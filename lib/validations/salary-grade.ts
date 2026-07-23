import { z } from "zod"

export const salaryGradeSchema = z
  .object({
    code: z.string().min(1, "Golongan wajib diisi"),
    subGrade: z.string().min(1, "Ruang wajib diisi"),
    minSalary: z.coerce.number().nonnegative().optional().or(z.literal("")),
    maxSalary: z.coerce.number().nonnegative().optional().or(z.literal("")),
    displayOrder: z.coerce.number().int().default(0),
  })
  .refine(
    (data) =>
      data.minSalary === "" ||
      data.maxSalary === "" ||
      data.minSalary === undefined ||
      data.maxSalary === undefined ||
      data.maxSalary >= data.minSalary,
    { message: "Gaji maksimum tidak boleh kurang dari gaji minimum", path: ["maxSalary"] }
  )

export type SalaryGradeFormValues = z.infer<typeof salaryGradeSchema>
