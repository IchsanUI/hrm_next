"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { revalidatePath } from "next/cache"
import sharp from "sharp"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { payrollSettingsSchema } from "@/lib/validations/payroll-settings"

export type PayrollSettingsState = { error?: string } | undefined
export type LetterheadUploadState = { error?: string; success?: boolean } | undefined

const PATH = "/admin/payroll/pengaturan"

export async function updatePayrollSettingsAction(
  _prevState: PayrollSettingsState,
  formData: FormData
): Promise<PayrollSettingsState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Anda tidak berhak mengubah pengaturan ini." }
  }

  const parsed = payrollSettingsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  const values = {
    cutoffDay: data.cutoffDay,
    paymentDay: data.paymentDay,
    bankName: data.bankName || null,
    bankAccountNumber: data.bankAccountNumber || null,
    bankAccountHolder: data.bankAccountHolder || null,
    watermarkText: data.watermarkText || null,
  }

  await prisma.payrollSettings.upsert({
    where: { id: 1 },
    update: values,
    create: { id: 1, ...values },
  })

  await logActivity({
    userId: session.user.id ? Number(session.user.id) : null,
    username: session.user.username,
    action: "UPDATE",
    entityType: "PayrollSettings",
    description: `${session.user.username} memperbarui pengaturan umum Payroll (cut-off tanggal ${data.cutoffDay}, pembayaran tanggal ${data.paymentDay}).`,
  })

  revalidatePath(PATH)
  return undefined
}

// Kop surat perusahaan — banner gambar (logo + nama + alamat, sesuai desain
// resmi mereka) dipakai di bagian atas PDF Slip Gaji. Disimpan APA ADANYA
// (cuma dibatasi lebar maks biar filenya tidak raksasa) — beda dari
// foto/tanda tangan pegawai yang di-crop rasio tetap (500x500/400x200),
// karena rasio letterhead bervariasi (biasanya banner lebar-pendek).
export async function uploadPayrollLetterheadAction(
  _prevState: LetterheadUploadState,
  formData: FormData
): Promise<LetterheadUploadState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Anda tidak berhak mengubah pengaturan ini." }
  }

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

  const uploadDir = path.join(process.cwd(), "public", "uploads", "payroll")
  await mkdir(uploadDir, { recursive: true })
  const fileName = `kop-surat-${Date.now()}.png`
  await writeFile(path.join(uploadDir, fileName), resized)

  await prisma.payrollSettings.upsert({
    where: { id: 1 },
    update: { letterheadUrl: `/uploads/payroll/${fileName}` },
    create: { id: 1, letterheadUrl: `/uploads/payroll/${fileName}` },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "PayrollSettings",
    description: `${session.user.username} mengunggah kop surat Payroll.`,
  })

  revalidatePath(PATH)
  return { success: true }
}

export async function removePayrollLetterheadAction(): Promise<LetterheadUploadState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Anda tidak berhak mengubah pengaturan ini." }
  }

  await prisma.payrollSettings.upsert({
    where: { id: 1 },
    update: { letterheadUrl: null },
    create: { id: 1 },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "PayrollSettings",
    description: `${session.user.username} menghapus kop surat Payroll.`,
  })

  revalidatePath(PATH)
  return { success: true }
}
