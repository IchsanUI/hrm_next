import { z } from "zod"

export const salaryScaleVersionSchema = z.object({
  name: z.string().min(1, "Nama/acuan peraturan wajib diisi"),
  effectiveDate: z.string().min(1, "Tanggal berlaku wajib diisi"),
})

export type SalaryScaleVersionFormValues = z.infer<typeof salaryScaleVersionSchema>
