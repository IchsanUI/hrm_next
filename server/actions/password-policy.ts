"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { invalidatePasswordPolicyCache } from "@/lib/password-policy"
import { requireSuperAdmin } from "@/server/actions/access"

export type PasswordPolicyState = { error?: string; success?: boolean } | undefined

const schema = z
  .object({
    enabled: z.enum(["on", "off"]),
    intervalDays: z.coerce.number().int().min(30, "Interval minimal 30 hari").max(365, "Interval maksimal 365 hari"),
    warningDays: z.coerce.number().int().min(1, "Pengingat minimal 1 hari").max(60, "Pengingat maksimal 60 hari"),
    historyCount: z.coerce.number().int().min(1, "Riwayat minimal 1").max(24, "Riwayat maksimal 24"),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai berlaku wajib diisi"),
  })
  .refine((v) => v.warningDays < v.intervalDays, {
    message: "Masa pengingat harus lebih pendek dari interval",
    path: ["warningDays"],
  })

// Kebijakan masa berlaku password (PRD docs/prd-masa-berlaku-password.md
// 4.1) — hanya SUPER_ADMIN. Berlaku prospektif: TIDAK menyentuh
// passwordChangedAt pengguna mana pun.
export async function updatePasswordPolicyAction(
  _prev: PasswordPolicyState,
  formData: FormData
): Promise<PasswordPolicyState> {
  const session = await requireSuperAdmin()

  const parsed = schema.safeParse({
    enabled: formData.get("enabled") === "on" ? "on" : "off",
    intervalDays: formData.get("intervalDays"),
    warningDays: formData.get("warningDays"),
    historyCount: formData.get("historyCount"),
    effectiveDate: formData.get("effectiveDate"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Periksa kembali isian." }
  }
  const v = parsed.data
  const enabled = v.enabled === "on"
  // Tanggal mulai = pukul 00:00 WIB pada tanggal yang dipilih.
  const effectiveAt = new Date(`${v.effectiveDate}T00:00:00+07:00`)

  const data = {
    intervalDays: enabled ? v.intervalDays : null,
    warningDays: v.warningDays,
    historyCount: v.historyCount,
    effectiveAt: enabled ? effectiveAt : null,
    updatedByUserId: Number(session.user.id),
  }
  await prisma.passwordPolicy.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } })
  invalidatePasswordPolicyCache()

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "PasswordPolicy",
    description: enabled
      ? `${session.user.username} mengatur kebijakan password: wajib ganti tiap ${v.intervalDays} hari mulai ${v.effectiveDate}, pengingat ${v.warningDays} hari sebelumnya, tolak ${v.historyCount} password terakhir.`
      : `${session.user.username} menonaktifkan masa berlaku password (riwayat: tolak ${v.historyCount} password terakhir).`,
  })

  revalidatePath("/admin/keamanan/kebijakan")
  revalidatePath("/admin/manajemen-pengguna")
  return { success: true }
}
