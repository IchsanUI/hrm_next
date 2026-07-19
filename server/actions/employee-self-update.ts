"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { employeeSelfUpdateSchema } from "@/lib/validations/employee"

export type SelfUpdateFormState = { error?: string; success?: boolean } | undefined

// Pegawai update kontak/alamat miliknya sendiri — HANYA kalau admin sudah
// mengaktifkan Employee.allowSelfUpdate (lihat toggleEmployeeSelfUpdateAction
// di server/actions/employees.ts). Otomatis mengunci lagi izinnya begitu
// berhasil disimpan, sesuai pola "jendela update tahunan".
export async function updateOwnProfileAction(
  _prevState: SelfUpdateFormState,
  formData: FormData
): Promise<SelfUpdateFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { id: true, fullName: true, allowSelfUpdate: true },
  })
  if (!employee) {
    return { error: "Data pegawai tidak ditemukan." }
  }
  if (!employee.allowSelfUpdate) {
    return {
      error: "Izin update mandiri untuk akun Anda belum/tidak lagi aktif. Hubungi admin.",
    }
  }

  const parsed = employeeSelfUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      emergencyPhone: parsed.data.emergencyPhone || null,
      instagram: parsed.data.instagram || null,
      tiktok: parsed.data.tiktok || null,
      facebook: parsed.data.facebook || null,
      ktpAddress: parsed.data.ktpAddress || null,
      // Auto-lock — satu kali pakai per aktivasi admin.
      allowSelfUpdate: false,
    },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} memperbarui data kontak/alamat sendiri lewat Profil Saya.`,
  })

  revalidatePath("/pegawai/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}
