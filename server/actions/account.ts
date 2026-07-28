"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import sharp from "sharp"
import { revalidatePath } from "next/cache"

import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { updateUsernameSchema, updatePasswordSchema } from "@/lib/validations/account"

export type AccountFormState = { error?: string } | undefined
export type AvatarUploadState = { error?: string; success?: boolean } | undefined

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

// Foto profil AKUN — SENGAJA disimpan terpisah dari Employee.photoUrl (foto
// resmi kepegawaian yang cuma admin yang boleh ubah lewat Data Pegawai),
// jadi mengganti foto di sini TIDAK PERNAH menimpa foto pegawai resmi.
// Tidak perlu signOut (beda dari username/password) — foto cuma tampilan,
// bukan kredensial keamanan.
export async function updateAccountAvatarAction(
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const session = await auth()
  if (!session?.user) {
    return { error: "Sesi tidak valid, silakan login ulang." }
  }

  const file = formData.get("avatar")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file foto terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }

  const userId = Number(session.user.id)
  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer).resize(500, 500, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer()

  const uploadDir = path.join(process.cwd(), "public", "uploads", "akun-avatar")
  await mkdir(uploadDir, { recursive: true })
  const fileName = `${userId}-${Date.now()}.jpg`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: `/uploads/akun-avatar/${fileName}` },
  })

  await logActivity({
    userId,
    username: session.user.username,
    action: "UPDATE",
    entityType: "User",
    description: `${session.user.username} mengubah foto profil akunnya.`,
  })

  revalidatePath("/admin", "layout")
  revalidatePath("/pegawai", "layout")
  return { success: true }
}

export async function removeAccountAvatarAction(): Promise<AvatarUploadState> {
  const session = await auth()
  if (!session?.user) {
    return { error: "Sesi tidak valid, silakan login ulang." }
  }

  await prisma.user.update({
    where: { id: Number(session.user.id) },
    data: { avatarUrl: null },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "User",
    description: `${session.user.username} menghapus foto profil akunnya.`,
  })

  revalidatePath("/admin", "layout")
  revalidatePath("/pegawai", "layout")
  return { success: true }
}
