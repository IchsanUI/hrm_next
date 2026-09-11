"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export type DocumentWatermarkState = { error?: string; success?: boolean } | undefined

const PATH = "/admin/pegawai/pengaturan"

// Sama pola akses dengan halaman Pengaturan Kepegawaian sendiri — SUPER_ADMIN
// selalu boleh, HR_ADMIN cuma kalau sudah dibuka lewat Manajemen Akses HR.
// Diperiksa di sini, bukan sekadar mengandalkan penjaga rute di proxy.ts,
// karena server action bisa di-POST ke path mana pun.
async function assertCanManage() {
  const session = await auth()
  const role = session?.user.role
  const allowed =
    role === "SUPER_ADMIN" ||
    (role === "HR_ADMIN" && session?.user.menuAccess.includes("kepegawaian.pengaturan"))
  if (!session?.user || !allowed) {
    return { session: null, error: "Anda tidak berhak mengubah pengaturan ini." }
  }
  return { session, error: null }
}

export async function updateDocumentWatermarkAction(
  _prevState: DocumentWatermarkState,
  formData: FormData
): Promise<DocumentWatermarkState> {
  const { session, error } = await assertCanManage()
  if (!session) return { error: error! }

  const enabled = formData.get("watermarkEnabled") === "on"
  const text = String(formData.get("watermarkText") ?? "").trim()
  if (text.length > 120) {
    return { error: "Teks tambahan maksimal 120 karakter agar tidak menutupi isi dokumen." }
  }

  await prisma.employeeDocumentSettings.upsert({
    where: { id: 1 },
    update: { watermarkEnabled: enabled, watermarkText: text || null },
    create: { id: 1, watermarkEnabled: enabled, watermarkText: text || null },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "EmployeeDocumentSettings",
    description: `${session.user.username} ${
      enabled ? "mengaktifkan" : "menonaktifkan"
    } watermark dokumen pegawai.`,
  })

  revalidatePath(PATH)
  return { success: true }
}
