"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

import sharp from "sharp"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"

export type PhotoUploadState = { error?: string; success?: boolean } | undefined

export async function uploadEmployeePhotoAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const file = formData.get("photo")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file foto terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(500, 500, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer()

  const uploadDir = path.join(process.cwd(), "public", "uploads", "pegawai")
  await mkdir(uploadDir, { recursive: true })

  const fileName = `${employeeId}-${Date.now()}.jpg`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.employee.update({
    where: { id: employeeId },
    data: { photoUrl: `/uploads/pegawai/${fileName}` },
  })

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeSignatureAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
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

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeInitialsAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
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

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeFingerprintRightAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
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

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}

export async function uploadEmployeeFingerprintLeftAction(
  employeeId: number,
  _prevState: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
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

  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
  return { success: true }
}
