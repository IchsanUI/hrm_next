import { z } from "zod"

export const payrollSettingsSchema = z.object({
  cutoffDay: z.coerce.number().int().min(1, "Minimal tanggal 1").max(28, "Maksimal tanggal 28 (aman untuk semua bulan termasuk Februari)"),
  paymentDay: z.coerce.number().int().min(1, "Minimal tanggal 1").max(28, "Maksimal tanggal 28 (aman untuk semua bulan termasuk Februari)"),
  bankName: z.string().trim().optional().or(z.literal("")),
  bankAccountNumber: z.string().trim().optional().or(z.literal("")),
  bankAccountHolder: z.string().trim().optional().or(z.literal("")),
  watermarkText: z.string().trim().max(40, "Maksimal 40 karakter").optional().or(z.literal("")),
})

export type PayrollSettingsFormValues = z.infer<typeof payrollSettingsSchema>
