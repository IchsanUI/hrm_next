import { z } from "zod"

import { passwordRules } from "@/lib/validations/account"

const passwordField = z
  .string()
  .min(passwordRules.minLength, `Password minimal ${passwordRules.minLength} karakter`)
  .regex(passwordRules.hasLower, "Password harus mengandung huruf kecil")
  .regex(passwordRules.hasUpper, "Password harus mengandung huruf besar")
  .regex(passwordRules.hasNumber, "Password harus mengandung angka")
  .regex(passwordRules.hasSpecial, "Password harus mengandung karakter spesial")

// Role akun sistem murni (tanpa employeeId) — cuma dua pilihan ini karena
// EMPLOYEE tanpa employeeId tidak bisa akses apa-apa (lihat proxy.ts).
export const SYSTEM_ACCOUNT_ROLES = ["SUPER_ADMIN", "HR_ADMIN"] as const

export const createSystemAccountSchema = z
  .object({
    username: z.string().trim().min(3, "Username minimal 3 karakter"),
    password: passwordField,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
    role: z.enum(SYSTEM_ACCOUNT_ROLES),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  })

export const adminResetPasswordSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  })

export const updateSystemAccountRoleSchema = z.object({
  role: z.enum(SYSTEM_ACCOUNT_ROLES),
})
