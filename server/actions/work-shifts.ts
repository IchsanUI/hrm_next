"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { workShiftSchema } from "@/lib/validations/master-data"

export type MasterDataState = { error?: string; success?: boolean } | undefined

function toTimeDate(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`)
}

async function logWorkShift(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "WorkShift",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } jam kerja "${name}".`,
  })
}

export async function createWorkShiftAction(
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = workShiftSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  await prisma.workShift.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      checkInTime: toTimeDate(parsed.data.checkInTime),
      checkOutTime: toTimeDate(parsed.data.checkOutTime),
    },
  })
  await logWorkShift("CREATE", parsed.data.name)
  revalidatePath("/admin/jam-kerja")
  return { success: true }
}

export async function updateWorkShiftAction(
  id: number,
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = workShiftSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  await prisma.workShift.update({
    where: { id },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      checkInTime: toTimeDate(parsed.data.checkInTime),
      checkOutTime: toTimeDate(parsed.data.checkOutTime),
    },
  })
  await logWorkShift("UPDATE", parsed.data.name)
  revalidatePath("/admin/jam-kerja")
  return { success: true }
}

export async function deleteWorkShiftAction(id: number) {
  const workShift = await prisma.workShift.findUnique({ where: { id } })
  try {
    await prisma.workShift.delete({ where: { id } })
  } catch {
    return {
      error: "Jam kerja masih dipakai oleh data pegawai, tidak bisa dihapus.",
    }
  }
  if (workShift) {
    await logWorkShift("DELETE", workShift.name)
  }
  revalidatePath("/admin/jam-kerja")
  return undefined
}
