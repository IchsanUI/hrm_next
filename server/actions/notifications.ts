"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function markNotificationReadAction(id: number) {
  const session = await auth()
  if (!session?.user.id) return

  await prisma.notification.updateMany({
    where: { id, userId: Number(session.user.id) },
    data: { isRead: true },
  })
  revalidatePath("/", "layout")
}

export async function markAllNotificationsReadAction() {
  const session = await auth()
  if (!session?.user.id) return

  await prisma.notification.updateMany({
    where: { userId: Number(session.user.id), isRead: false },
    data: { isRead: true },
  })
  revalidatePath("/", "layout")
}
