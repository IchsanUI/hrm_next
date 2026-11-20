"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

import sharp from "sharp"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { saveEmployeePhotoFile } from "@/lib/employee-photo-storage"

export type PhotoUploadState = { error?: string; success?: boolean } | undefined

// WAJIB Super Admin/HR Admin — foto, TTD, paraf & sidik jari pegawai dipakai
// di dokumen resmi & identifikasi; tanpa cek ini siapa pun yang bisa
// memanggil server action bisa menimpa milik pegawai lain. Pegawai yang
// memperbarui pas fotonya sendiri lewat jalur terpisah
// (server/actions/employee-self-update.ts, wajib izin Update Mandiri).
async function requireEmployeeAdmin(): Promise<PhotoUploadState | null> {
  const session = await auth()
  if (!session?.user) return { error: "Sesi tidak valid, silakan login ulang." }
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "HR_ADMIN") {
    return { error: "Hanya Super Admin/HR Admin yang bisa mengunggah file ini." }
  }
  return null
}

// Best-effort — dilewati kalau session/data pegawainya tidak ketemu.
async function logPhotoActivity(employeeId: number, label: string) {
  const session = await auth()
  if (!session?.user) return
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeNumber: true },
  })
  if (!employee) return

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} mengunggah ${label} untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })
}

export async function uploadEmployeePhotoAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const denied = await requireEmployeeAdmin()
  if (denied) return denied

  const saved = await saveEmployeePhotoFile(formData.get("photo"), employeeId)
  if ("error" in saved) return { error: saved.error }

  await prisma.employee.update({
    where: { id: employeeId },
    data: { photoUrl: saved.url },
  })
  await logPhotoActivity(employeeId, "foto profil")

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeSignatureAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const denied = await requireEmployeeAdmin()
  if (denied) return denied

  const file = formData.get("signature")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file tanda tangan terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(400, 200, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()

  const uploadDir = path.join(process.cwd(), "public", "uploads", "ttd")
  await mkdir(uploadDir, { recursive: true })

  const fileName = `${employeeId}-${Date.now()}.png`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.employee.update({
    where: { id: employeeId },
    data: { signatureUrl: `/uploads/ttd/${fileName}` },
  })
  await logPhotoActivity(employeeId, "tanda tangan")

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeInitialsAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const denied = await requireEmployeeAdmin()
  if (denied) return denied

  const file = formData.get("initials")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file paraf terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(400, 200, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()

  const uploadDir = path.join(process.cwd(), "public", "uploads", "paraf")
  await mkdir(uploadDir, { recursive: true })

  const fileName = `${employeeId}-${Date.now()}.png`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.employee.update({
    where: { id: employeeId },
    data: { initialsUrl: `/uploads/paraf/${fileName}` },
  })
  await logPhotoActivity(employeeId, "paraf")

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeFingerprintRightAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const denied = await requireEmployeeAdmin()
  if (denied) return denied

  const file = formData.get("fingerprintRight")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file sidik jari kanan terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(300, 300, { fit: "cover" })
    .png()
    .toBuffer()

  const uploadDir = path.join(process.cwd(), "public", "uploads", "sidik-jari")
  await mkdir(uploadDir, { recursive: true })

  const fileName = `${employeeId}-kanan-${Date.now()}.png`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.employee.update({
    where: { id: employeeId },
    data: { fingerprintRightUrl: `/uploads/sidik-jari/${fileName}` },
  })
  await logPhotoActivity(employeeId, "sidik jari kanan")

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeFingerprintLeftAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const denied = await requireEmployeeAdmin()
  if (denied) return denied

  const file = formData.get("fingerprintLeft")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file sidik jari kiri terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(300, 300, { fit: "cover" })
    .png()
    .toBuffer()

  const uploadDir = path.join(process.cwd(), "public", "uploads", "sidik-jari")
  await mkdir(uploadDir, { recursive: true })

  const fileName = `${employeeId}-kiri-${Date.now()}.png`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.employee.update({
    where: { id: employeeId },
    data: { fingerprintLeftUrl: `/uploads/sidik-jari/${fileName}` },
  })
  await logPhotoActivity(employeeId, "sidik jari kiri")

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}
