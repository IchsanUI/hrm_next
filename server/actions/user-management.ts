"use server"

import { Prisma, RoleName } from "@prisma/client"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { requireSuperAdmin } from "@/server/actions/access"
import {
  createSystemAccountSchema,
  adminResetPasswordSchema,
  updateSystemAccountRoleSchema,
} from "@/lib/validations/user-management"

export type UserManagementState = { error?: string; success?: boolean } | undefined

const PATH = "/admin/manajemen-pengguna"

// Guard umum: SUPER_ADMIN tidak boleh menonaktifkan/menurunkan dirinya
// sendiri lewat menu ini (harus lewat menu Peraturan miliknya sendiri), dan
// tidak boleh sampai tidak ada SUPER_ADMIN aktif tersisa sama sekali.
async function assertNotLastActiveSuperAdmin(excludeUserId: number) {
  const superAdminRole = await prisma.role.findUnique({
    where: { name: RoleName.SUPER_ADMIN },
  })
  if (!superAdminRole) return
  const otherActiveSuperAdmins = await prisma.user.count({
    where: { roleId: superAdminRole.id, isActive: true, id: { not: excludeUserId } },
  })
  if (otherActiveSuperAdmins === 0) {
    throw new Error("LAST_SUPER_ADMIN")
  }
}

export async function createSystemAccountAction(
  _prevState: UserManagementState,
  formData: FormData
): Promise<UserManagementState> {
  const session = await requireSuperAdmin()

  const parsed = createSystemAccountSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const role = await prisma.role.findUnique({ where: { name: parsed.data.role } })
  if (!role) {
    return { error: "Role tidak ditemukan. Jalankan seed terlebih dahulu." }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  try {
    await prisma.user.create({
      data: {
        username: parsed.data.username,
        password: passwordHash,
        roleId: role.id,
        employeeId: null,
        isActive: true,
        menuAccess: [],
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Username sudah dipakai, coba yang lain." }
    }
    throw err
  }

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: "CREATE",
    entityType: "User",
    description: `${session!.user.username} membuat akun sistem baru "${parsed.data.username}" (role: ${parsed.data.role}).`,
  })

  revalidatePath(PATH)
  return { success: true }
}

export async function adminResetPasswordAction(
  userId: number,
  _prevState: UserManagementState,
  formData: FormData
): Promise<UserManagementState> {
  const session = await requireSuperAdmin()
  if (userId === Number(session!.user.id)) {
    return { error: "Gunakan menu Peraturan untuk ganti password akun sendiri." }
  }

  const parsed = adminResetPasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    return { error: "Akun tidak ditemukan." }
  }

  const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { password: newPasswordHash },
  })

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: "UPDATE",
    entityType: "User",
    description: `${session!.user.username} mereset password akun "${targetUser.username}".`,
  })

  revalidatePath(PATH)
  return { success: true }
}

export async function toggleUserActiveAction(
  userId: number,
  isActive: boolean
): Promise<UserManagementState> {
  const session = await requireSuperAdmin()
  if (userId === Number(session!.user.id)) {
    return { error: "Tidak bisa menonaktifkan akun sendiri lewat sini." }
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    return { error: "Akun tidak ditemukan." }
  }

  if (!isActive) {
    try {
      await assertNotLastActiveSuperAdmin(userId)
    } catch (err) {
      if (err instanceof Error && err.message === "LAST_SUPER_ADMIN") {
        return { error: "Tidak bisa menonaktifkan Super Admin terakhir." }
      }
      throw err
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } })

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
    entityType: "User",
    description: `${session!.user.username} ${isActive ? "mengaktifkan" : "menonaktifkan"} akun "${targetUser.username}".`,
  })

  revalidatePath(PATH)
  return { success: true }
}

export async function updateSystemAccountRoleAction(
  userId: number,
  _prevState: UserManagementState,
  formData: FormData
): Promise<UserManagementState> {
  const session = await requireSuperAdmin()
  if (userId === Number(session!.user.id)) {
    return { error: "Tidak bisa mengubah role akun sendiri lewat sini." }
  }

  const parsed = updateSystemAccountRoleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Role tidak valid." }
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    return { error: "Akun tidak ditemukan." }
  }
  if (targetUser.employeeId !== null) {
    return { error: "Akun ini terhubung ke data pegawai, ubah role lewat Manajemen Akses HR." }
  }

  if (parsed.data.role !== "SUPER_ADMIN") {
    try {
      await assertNotLastActiveSuperAdmin(userId)
    } catch (err) {
      if (err instanceof Error && err.message === "LAST_SUPER_ADMIN") {
        return { error: "Tidak bisa menurunkan Super Admin terakhir." }
      }
      throw err
    }
  }

  const role = await prisma.role.findUnique({ where: { name: parsed.data.role } })
  if (!role) {
    return { error: "Role tidak ditemukan. Jalankan seed terlebih dahulu." }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      roleId: role.id,
      // Menu access cuma relevan buat HR_ADMIN yang terhubung ke pegawai —
      // akun sistem selalu direset ke kosong tiap ganti role, konsisten
      // dengan setHrAdminAccessAction saat revoke.
      menuAccess: [],
    },
  })

  await logActivity({
    userId: Number(session!.user.id),
    username: session!.user.username,
    action: "UPDATE",
    entityType: "User",
    description: `${session!.user.username} mengubah role akun "${targetUser.username}" menjadi ${parsed.data.role}.`,
  })

  revalidatePath(PATH)
  return { success: true }
}
