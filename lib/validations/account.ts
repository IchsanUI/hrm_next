import { z } from "zod"

export const updateUsernameSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
})

export const passwordRules = {
  minLength: 8,
  hasLower: /[a-z]/,
  hasUpper: /[A-Z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[^A-Za-z0-9]/,
}

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z
      .string()
      .min(passwordRules.minLength, `Password baru minimal ${passwordRules.minLength} karakter`)
      .regex(passwordRules.hasLower, "Password baru harus mengandung huruf kecil")
      .regex(passwordRules.hasUpper, "Password baru harus mengandung huruf besar")
      .regex(passwordRules.hasNumber, "Password baru harus mengandung angka")
      .regex(passwordRules.hasSpecial, "Password baru harus mengandung karakter spesial"),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  })
