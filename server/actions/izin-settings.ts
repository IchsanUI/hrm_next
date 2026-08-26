"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { revalidatePath } from "next/cache"
import sharp from "sharp"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export type LetterheadUploadState = { error?: string; success?: boolean } | undefined

const PATH = "/admin/izin/pengaturan"

// Sama pola akses dengan halaman Pengaturan Izin sendiri (lihat
// app/admin/izin/pengaturan/page.tsx) — SUPER_ADMIN selalu boleh, HR_ADMIN
// cuma boleh kalau sudah dibuka lewat Manajemen Akses HR (menu key
// "approval.pengaturan").
async function assertCanManageIzinSettings() {
  const session = await auth()
  const role = session?.user.role
  const hasAccess =
    role === "SUPER_ADMIN" || (role === "HR_ADMIN" && session?.user.menuAccess.includes("approval.pengaturan"))
  if (!session?.user || !hasAccess) {
    return { session: null, error: "Anda tidak berhak mengubah pengaturan ini." }
  }
  return { session, error: null }
}

// Kop surat perusahaan — banner gambar (logo + nama + alamat, sesuai desain
// resmi mereka) dipakai di bagian atas SEMUA format cetak surat izin. Sama
// persis pola resize/simpannya dengan uploadPayrollLetterheadAction (disimpan
// apa adanya, cuma dibatasi lebar maks, bukan di-crop rasio tetap — rasio
// letterhead bervariasi, biasanya banner lebar-pendek).
export async function uploadIzinLetterheadAction(
  _prevState: LetterheadUploadState,
  formData: FormData
): Promise<LetterheadUploadState> {
  const { session, error } = await assertCanManageIzinSettings()
  if (!session) return { error: error! }

  const file = formData.get("letterhead")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file kop surat terlebih dahulu." }
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File harus berupa gambar." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(1600, undefined, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()

  const uploadDir = path.join(process.cwd(), "public", "uploads", "izin")
  await mkdir(uploadDir, { recursive: true })
  const fileName = `kop-surat-${Date.now()}.png`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.izinSettings.upsert({
    where: { id: 1 },
    update: { letterheadUrl: `/uploads/izin/${fileName}` },
    create: { id: 1, letterheadUrl: `/uploads/izin/${fileName}` },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "IzinSettings",
    description: `${session.user.username} mengunggah kop surat Izin.`,
  })

  revalidatePath(PATH)
  return { success: true }
}

export type OvertimeAutoRejectToggleState = { error?: string; success?: boolean } | undefined

// SENGAJA cuma SUPER_ADMIN (BUKAN assertCanManageIzinSettings yang juga
// mengizinkan HR_ADMIN ber-akses "approval.pengaturan") — mematikan ini
// berarti pengajuan lembur yang didiamkan Atasan Langsung akan menggantung
// PENDING_APPROVAL selamanya, efeknya ke seluruh organisasi, bukan sekadar
// pengaturan tampilan/format seperti kop surat.
export async function setOvertimeAutoRejectEnabledAction(
  enabled: boolean
): Promise<OvertimeAutoRejectToggleState> {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return { error: "Hanya Super Admin yang boleh mengubah pengaturan ini." }
  }

  await prisma.izinSettings.upsert({
    where: { id: 1 },
    update: { overtimeAutoRejectEnabled: enabled },
    create: { id: 1, overtimeAutoRejectEnabled: enabled },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "IzinSettings",
    description: `${session.user.username} ${enabled ? "mengaktifkan" : "menonaktifkan"} auto-reject Izin Lembur 24 jam.`,
  })

  revalidatePath(PATH)
  return { success: true }
}

export async function removeIzinLetterheadAction(): Promise<LetterheadUploadState> {
  const { session, error } = await assertCanManageIzinSettings()
  if (!session) return { error: error! }

  await prisma.izinSettings.upsert({
    where: { id: 1 },
    update: { letterheadUrl: null },
    create: { id: 1 },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "IzinSettings",
    description: `${session.user.username} menghapus kop surat Izin.`,
  })

  revalidatePath(PATH)
  return { success: true }
}
