"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { requireSuperAdmin } from "@/server/actions/access"

const PATH = "/admin/manajemen-pengguna"

export type LoginIpBlockState = { error?: string; success?: boolean } | undefined

// Buka blokir IP yang kena limiter percobaan login dengan username tak
// dikenal (lihat lib/auth/login-security.ts) — baik yang masih cooldown
// berjenjang maupun yang sudah diblokir permanen.
export async function unblockIpAction(id: number): Promise<LoginIpBlockState> {
  const session = await requireSuperAdmin()

  const block = await prisma.loginIpBlock.findUnique({ where: { id } })
  if (!block) {
    return { error: "Data blokir tidak ditemukan." }
  }

  await prisma.loginIpBlock.delete({ where: { id } })

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: "UPDATE",
    entityType: "Auth",
    description: `${session!.user.username} membuka blokir IP ${block.ip}.`,
  })

  revalidatePath(PATH)
  return { success: true }
}
