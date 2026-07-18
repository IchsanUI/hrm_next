"use server"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"

import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { updateUsernameSchema, updatePasswordSchema } from "@/lib/validations/account"

export type AccountFormState = { error?: string } | undefined

export async function updateUsernameAction(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await auth()
  if (!session?.user) {
    return { error: "Sesi tidak valid, silakan login ulang." }
  }

  const parsed = updateUsernameSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Username tidak valid." }
  }

  const oldUsername = session.user.username

  try {
    await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: { username: parsed.data.username },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Username sudah dipakai, coba yang lain." }
    }
    throw err
  }

  await logActivity({
    userId: Number(session.user.id),
    username: parsed.data.username,
    action: "UPDATE",
    entityType: "User",
    description: `${oldUsername} mengubah username menjadi "${parsed.data.username}".`,
  })

  await signOut({ redirectTo: "/login?toast=username-updated" })
}

export async function updatePasswordAction(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await auth()
  if (!session?.user) {
    return { error: "Sesi tidak valid, silakan login ulang." }
  }

  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const user = await prisma.user.findUnique({ where: { id: Number(session.user.id) } })
  if (!user) {
    return { error: "Akun tidak ditemukan." }
  }

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!isValid) {
    return { error: "Password saat ini salah." }
  }

  const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: newPasswordHash },
  })

  await logActivity({
    userId: user.id,
    username: user.username,
    action: "UPDATE",
    entityType: "User",
    description: `${user.username} mengubah password akunnya.`,
  })

  await signOut({ redirectTo: "/login?toast=password-updated" })
}
