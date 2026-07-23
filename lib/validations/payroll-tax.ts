import { z } from "zod"

export const bpjsSettingsSchema = z.object({
  kesehatanEmployeePercent: z.coerce.number().nonnegative(),
  kesehatanCompanyPercent: z.coerce.number().nonnegative(),
  kesehatanSalaryCap: z.coerce.number().nonnegative().optional().or(z.literal("")),
  jhtEmployeePercent: z.coerce.number().nonnegative(),
  jhtCompanyPercent: z.coerce.number().nonnegative(),
  jpEmployeePercent: z.coerce.number().nonnegative(),
  jpCompanyPercent: z.coerce.number().nonnegative(),
  jpSalaryCap: z.coerce.number().nonnegative().optional().or(z.literal("")),
  jkkCompanyPercent: z.coerce.number().nonnegative(),
  jkmCompanyPercent: z.coerce.number().nonnegative(),
})

export type BpjsSettingsFormValues = z.infer<typeof bpjsSettingsSchema>

export const PTKP_STATUSES = ["TK0", "TK1", "TK2", "TK3", "K0", "K1", "K2", "K3"] as const

export const PTKP_STATUS_LABEL: Record<(typeof PTKP_STATUSES)[number], string> = {
  TK0: "TK/0 — Tidak Kawin, 0 Tanggungan",
  TK1: "TK/1 — Tidak Kawin, 1 Tanggungan",
  TK2: "TK/2 — Tidak Kawin, 2 Tanggungan",
  TK3: "TK/3 — Tidak Kawin, 3 Tanggungan",
  K0: "K/0 — Kawin, 0 Tanggungan",
  K1: "K/1 — Kawin, 1 Tanggungan",
  K2: "K/2 — Kawin, 2 Tanggungan",
  K3: "K/3 — Kawin, 3 Tanggungan",
}

export const ptkpRatesSchema = z.object(
  Object.fromEntries(PTKP_STATUSES.map((s) => [s, z.coerce.number().nonnegative()]))
) as z.ZodObject<Record<(typeof PTKP_STATUSES)[number], z.ZodNumber>>

export const taxBracketSchema = z
  .object({
    order: z.coerce.number().int().default(0),
    minIncome: z.coerce.number().nonnegative(),
    maxIncome: z.coerce.number().nonnegative().optional().or(z.literal("")),
    ratePercent: z.coerce.number().nonnegative(),
  })
  .refine(
    (data) => data.maxIncome === "" || data.maxIncome === undefined || data.maxIncome > data.minIncome,
    { message: "Batas atas harus lebih besar dari batas bawah", path: ["maxIncome"] }
  )

export type TaxBracketFormValues = z.infer<typeof taxBracketSchema>
