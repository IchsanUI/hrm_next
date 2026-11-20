"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import {
  SESSION_IDLE_MAX_MINUTES,
  SESSION_IDLE_MIN_MINUTES,
  SESSION_WARNING_MAX_SECONDS,
  SESSION_WARNING_MIN_SECONDS,
} from "@/lib/session-idle"
import { getSessionPolicy, invalidateSessionPolicyCache } from "@/lib/session-policy"
import { requireSuperAdmin } from "@/server/actions/access"

export type SessionPolicyState = { error?: string; success?: boolean } | undefined

const schema = z
  .object({
    idleMinutes: z.coerce
      .number()
      .int()
      .min(SESSION_IDLE_MIN_MINUTES, `Minimal ${SESSION_IDLE_MIN_MINUTES} menit`)
      .max(SESSION_IDLE_MAX_MINUTES, `Maksimal ${SESSION_IDLE_MAX_MINUTES} menit`),
    warningSeconds: z.coerce
      .number()
      .int()
      .min(SESSION_WARNING_MIN_SECONDS, `Peringatan minimal ${SESSION_WARNING_MIN_SECONDS} detik`)
      .max(SESSION_WARNING_MAX_SECONDS, `Peringatan maksimal ${SESSION_WARNING_MAX_SECONDS} detik`),
  })
  .refine((v) => v.warningSeconds <= (v.idleMinutes * 60) / 2, {
    message: "Peringatan maksimal separuh dari durasi logout otomatis",
    path: ["warningSeconds"],
  })

// Durasi logout otomatis — hanya SUPER_ADMIN. Berlaku untuk semua pengguna
// di request berikutnya (tanpa memaksa siapa pun logout saat disimpan).
export async function updateSessionPolicyAction(
  _prev: SessionPolicyState,
  formData: FormData
): Promise<SessionPolicyState> {
  const session = await requireSuperAdmin()

  const parsed = schema.safeParse({
    idleMinutes: formData.get("idleMinutes"),
    warningSeconds: formData.get("warningSeconds"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Periksa kembali isian." }
  }
  const { idleMinutes, warningSeconds } = parsed.data
  const before = await getSessionPolicy()

  const data = { idleMinutes, warningSeconds, updatedByUserId: Number(session.user.id) }
  await prisma.sessionPolicy.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } })
  invalidateSessionPolicyCache()

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "SessionPolicy",
    description: `${session.user.username} mengubah logout otomatis: ${before.idleMinutes} → ${idleMinutes} menit tidak aktif (peringatan ${warningSeconds} detik sebelumnya).`,
  })

  revalidatePath("/admin/keamanan/kebijakan")
  return { success: true }
}
