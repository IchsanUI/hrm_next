"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export type PushSubscriptionState = { error?: string; success?: boolean } | undefined

export type PushSubscriptionJSON = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function subscribeToPushAction(
  subscription: PushSubscriptionJSON,
  userAgent: string
): Promise<PushSubscriptionState> {
  const session = await auth()
  if (!session?.user.id) {
    return { error: "Sesi tidak valid, silakan login ulang." }
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    // endpoint dari browser yang sama tapi login akun berbeda (device
    // dipakai gantian) — pindah kepemilikan ke user yang lagi aktif.
    update: {
      userId: Number(session.user.id),
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    create: {
      userId: Number(session.user.id),
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
  })

  return { success: true }
}

export async function unsubscribeFromPushAction(endpoint: string): Promise<PushSubscriptionState> {
  const session = await auth()
  if (!session?.user.id) {
    return { error: "Sesi tidak valid, silakan login ulang." }
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: Number(session.user.id) },
  })

  return { success: true }
}
