import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"

type LogParams = {
  userId?: number | null
  username: string
  action: string
  entityType: string
  description: string
}

async function getRequestMeta() {
  try {
    const h = await headers()
    const forwardedFor = h.get("x-forwarded-for")
    const ipAddress = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : (h.get("x-real-ip") ?? null)
    const userAgent = h.get("user-agent")
    return { ipAddress, userAgent }
  } catch {
    return { ipAddress: null, userAgent: null }
  }
}

// Best-effort audit logging — dipanggil dari server action lain setelah
// mutasi berhasil. Kegagalan menulis log tidak boleh menggagalkan aksi
// utamanya, jadi errornya cukup dicatat ke console, bukan dilempar ulang.
export async function logActivity(params: LogParams) {
  try {
    const { ipAddress, userAgent } = await getRequestMeta()
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        username: params.username,
        action: params.action,
        entityType: params.entityType,
        description: params.description,
        ipAddress,
        userAgent,
      },
    })
  } catch (err) {
    console.error("Gagal mencatat activity log:", err)
  }
}
