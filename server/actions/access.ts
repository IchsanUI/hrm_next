"use server"

import { RoleName } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export type AccessActionState = { error?: string } | undefined

async function requireSuperAdmin() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    throw new Error("Hanya Super Admin yang bisa mengubah hak akses.")
  }
  return session
}

export async function setHrAdminAccessAction(
  userId: number,
  makeHrAdmin: boolean
): Promise<AccessActionState> {
  const session = await requireSuperAdmin()

  const targetRole = await prisma.role.findUnique({
    where: { name: makeHrAdmin ? RoleName.HR_ADMIN : RoleName.EMPLOYEE },
  })
  if (!targetRole) {
    return { error: "Role tidak ditemukan. Jalankan seed terlebih dahulu." }
  }

  const targetUser = await prisma.user.update({
    where: { id: userId },
    data: { roleId: targetRole.id },
  })

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: makeHrAdmin ? "GRANT_HR_ADMIN" : "REVOKE_HR_ADMIN",
    entityType: "User",
    description: makeHrAdmin
      ? `${session!.user.username} memberikan akses HR Admin ke "${targetUser.username}".`
      : `${session!.user.username} mencabut akses HR Admin dari "${targetUser.username}".`,
  })

  revalidatePath("/admin/akses-hr")
  return undefined
}
