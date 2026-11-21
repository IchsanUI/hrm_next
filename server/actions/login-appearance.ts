"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { invalidateLoginAppearanceCache } from "@/lib/login-appearance"
import {
  LOGIN_SLIDE_SECONDS,
  LOGIN_TAGLINE_LIMITS,
  LOGIN_WALLPAPER_MAX_COUNT,
} from "@/lib/login-appearance-shared"
import { deleteLoginWallpaperFile, saveLoginWallpaperFile } from "@/lib/login-wallpaper-storage"

export type LoginAppearanceResult = { error?: string; success?: boolean }

async function requireSuperAdmin() {
  const session = await auth()
  return session?.user.role === "SUPER_ADMIN" ? session.user : null
}

async function done(user: { id: string; username: string }, description: string): Promise<LoginAppearanceResult> {
  invalidateLoginAppearanceCache()
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "LoginAppearance",
    description: `${user.username} ${description}`,
  })
  revalidatePath("/admin/tampilan-login")
  revalidatePath("/login")
  return { success: true }
}

export async function uploadLoginWallpaperAction(formData: FormData): Promise<LoginAppearanceResult> {
  const user = await requireSuperAdmin()
  if (!user) return { error: "Hanya Super Admin yang dapat mengatur tampilan login." }
  if ((await prisma.loginWallpaper.count()) >= LOGIN_WALLPAPER_MAX_COUNT) {
    return { error: `Maksimal ${LOGIN_WALLPAPER_MAX_COUNT} gambar. Hapus gambar yang tidak dipakai terlebih dahulu.` }
  }
  const saved = await saveLoginWallpaperFile(formData.get("file"))
  if ("error" in saved) return { error: saved.error }

  const label = String(formData.get("label") ?? "").trim().slice(0, 100) || null
  const last = await prisma.loginWallpaper.aggregate({ _max: { sortOrder: true } })
  await prisma.loginWallpaper.create({
    data: {
      imageUrl: saved.url,
      label,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
      uploadedBy: user.username,
    },
  })
  return done(user, `menambahkan gambar halaman login${label ? ` "${label}"` : ""} (${saved.width}×${saved.height}).`)
}

const updateSchema = z.object({
  label: z.string().trim().max(100).nullable(),
  focusX: z.number().int().min(0).max(100),
  focusY: z.number().int().min(0).max(100),
  isActive: z.boolean(),
})

export async function updateLoginWallpaperAction(
  id: number,
  input: z.infer<typeof updateSchema>
): Promise<LoginAppearanceResult> {
  const user = await requireSuperAdmin()
  if (!user) return { error: "Hanya Super Admin yang dapat mengatur tampilan login." }
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { error: "Data gambar tidak valid." }
  const existing = await prisma.loginWallpaper.findUnique({ where: { id } })
  if (!existing) return { error: "Gambar tidak ditemukan." }

  // Minimal satu gambar tetap aktif supaya panel login tidak kosong.
  if (existing.isActive && !parsed.data.isActive) {
    const activeCount = await prisma.loginWallpaper.count({ where: { isActive: true } })
    if (activeCount <= 1) return { error: "Minimal satu gambar harus tetap aktif." }
  }
  await prisma.loginWallpaper.update({
    where: { id },
    data: { ...parsed.data, label: parsed.data.label || null },
  })
  const name = parsed.data.label || existing.label || `#${id}`
  return done(
    user,
    `mengubah gambar halaman login "${name}" (${parsed.data.isActive ? "aktif" : "nonaktif"}, fokus ${parsed.data.focusX}% ${parsed.data.focusY}%).`
  )
}

export async function moveLoginWallpaperAction(id: number, direction: "up" | "down"): Promise<LoginAppearanceResult> {
  const user = await requireSuperAdmin()
  if (!user) return { error: "Hanya Super Admin yang dapat mengatur tampilan login." }
  const all = await prisma.loginWallpaper.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } })
  const index = all.findIndex((w) => w.id === id)
  const target = direction === "up" ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= all.length) return { success: true }
  const order = all.map((w) => w.id)
  ;[order[index], order[target]] = [order[target], order[index]]
  // Tulis ulang urutan 1..n supaya rapi (nilai lama bisa sama/loncat).
  await prisma.$transaction(order.map((wid, i) => prisma.loginWallpaper.update({ where: { id: wid }, data: { sortOrder: i + 1 } })))
  return done(user, "mengubah urutan gambar halaman login.")
}

export async function deleteLoginWallpaperAction(id: number): Promise<LoginAppearanceResult> {
  const user = await requireSuperAdmin()
  if (!user) return { error: "Hanya Super Admin yang dapat mengatur tampilan login." }
  const existing = await prisma.loginWallpaper.findUnique({ where: { id } })
  if (!existing) return { error: "Gambar tidak ditemukan." }
  if (existing.isActive) {
    const activeCount = await prisma.loginWallpaper.count({ where: { isActive: true } })
    if (activeCount <= 1) return { error: "Gambar ini satu-satunya yang aktif. Aktifkan gambar lain terlebih dahulu." }
  }
  await prisma.loginWallpaper.delete({ where: { id } })
  await deleteLoginWallpaperFile(existing.imageUrl)
  return done(user, `menghapus gambar halaman login "${existing.label ?? existing.imageUrl}".`)
}

const settingsSchema = z.object({
  slideSeconds: z
    .number()
    .int()
    .min(LOGIN_SLIDE_SECONDS.min, `Durasi minimal ${LOGIN_SLIDE_SECONDS.min} detik.`)
    .max(LOGIN_SLIDE_SECONDS.max, `Durasi maksimal ${LOGIN_SLIDE_SECONDS.max} detik.`),
  taglineWords: z
    .array(z.string().trim().min(1).max(LOGIN_TAGLINE_LIMITS.maxLength, `Setiap kata maksimal ${LOGIN_TAGLINE_LIMITS.maxLength} karakter.`))
    .min(1, "Isi minimal satu kata tagline.")
    .max(LOGIN_TAGLINE_LIMITS.maxWords, `Maksimal ${LOGIN_TAGLINE_LIMITS.maxWords} kata tagline.`),
})

export async function updateLoginSettingsAction(input: z.infer<typeof settingsSchema>): Promise<LoginAppearanceResult> {
  const user = await requireSuperAdmin()
  if (!user) return { error: "Hanya Super Admin yang dapat mengatur tampilan login." }
  const parsed = settingsSchema.safeParse({
    ...input,
    taglineWords: [...new Set(input.taglineWords.map((w) => w.trim()).filter(Boolean))],
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." }

  const data = { ...parsed.data, updatedByUserId: Number(user.id) }
  await prisma.loginSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } })
  return done(
    user,
    `mengubah tampilan login: slideshow ${parsed.data.slideSeconds} detik, tagline "${parsed.data.taglineWords.join(", ")}".`
  )
}
