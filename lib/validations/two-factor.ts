import { z } from "zod"

const totpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Kode harus 6 digit angka")

export const confirmTotpSetupSchema = z.object({
  code: totpCode,
})

export const disableTwoFactorSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  code: totpCode,
})

export const regenerateRecoveryCodesSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  code: totpCode,
})
