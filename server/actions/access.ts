"use server"

import { RoleName } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { HR_MENU_GROUPS, type HrMenuKey } from "@/lib/hr-menu-access"

export type AccessActionState = { error?: string } | undefined

export async function requireSuperAdmin() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    throw new Error("Hanya Super Admin yang bisa mengubah hak akses.")
  }
  return session
}

function menuLabel(keys: HrMenuKey[]) {
  if (keys.length === 0) return "tanpa menu (kosong)"
  return HR_MENU_GROUPS.filter((g) => keys.includes(g.key))
    .map((g) => g.label)
    .join(", ")
}

// menuAccess cuma dipakai kalau makeHrAdmin true — diabaikan (di-reset ke
// kosong) begitu dicabut, supaya kalau nanti diangkat HR Admin lagi tidak
// diam-diam mewarisi akses lama tanpa Super Admin sadar.
export async function setHrAdminAccessAction(
  userId: number,
  makeHrAdmin: boolean,
  menuAccess: HrMenuKey[] = []
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
    data: {
      roleId: targetRole.id,
      menuAccess: makeHrAdmin ? menuAccess : [],
    },
  })

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: makeHrAdmin ? "GRANT_HR_ADMIN" : "REVOKE_HR_ADMIN",
    entityType: "User",
    description: makeHrAdmin
      ? `${session!.user.username} memberikan akses HR Admin ke "${targetUser.username}" (menu: ${menuLabel(menuAccess)}).`
      : `${session!.user.username} mencabut akses HR Admin dari "${targetUser.username}".`,
  })

  revalidatePath("/admin/akses-hr")
  return undefined
}

// Ubah menu akses HR Admin yang sudah aktif, tanpa harus cabut+angkat ulang.
export async function updateHrAdminMenuAccessAction(
  userId: number,
  menuAccess: HrMenuKey[]
): Promise<AccessActionState> {
  const session = await requireSuperAdmin()

  const targetUser = await prisma.user.update({
    where: { id: userId },
    data: { menuAccess },
  })

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: "UPDATE",
    entityType: "User",
    description: `${session!.user.username} mengubah akses menu HR Admin "${targetUser.username}" jadi: ${menuLabel(menuAccess)}.`,
  })

  revalidatePath("/admin/akses-hr")
  return undefined
}
