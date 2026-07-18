"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { workShiftAdjustmentSchema } from "@/lib/validations/master-data"

export type MasterDataState = { error?: string; success?: boolean } | undefined

function toTimeDate(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`)
}

async function logAdjustment(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "WorkShiftAdjustment",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } penyesuaian jam kerja "${name}".`,
  })
}

export async function createWorkShiftAdjustmentAction(
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = workShiftAdjustmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  const data = parsed.data
  if (new Date(data.endDate) < new Date(data.startDate)) {
    return { error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }
  }

  await prisma.workShiftAdjustment.create({
    data: {
      workShiftId: data.workShiftId,
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      checkInTime: toTimeDate(data.checkInTime),
      checkOutTime: toTimeDate(data.checkOutTime),
    },
  })

  await logAdjustment("CREATE", data.name)
  revalidatePath("/admin/jam-kerja")
  return { success: true }
}

export async function updateWorkShiftAdjustmentAction(
  id: number,
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = workShiftAdjustmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  const data = parsed.data
  if (new Date(data.endDate) < new Date(data.startDate)) {
    return { error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }
  }

  await prisma.workShiftAdjustment.update({
    where: { id },
    data: {
      workShiftId: data.workShiftId,
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      checkInTime: toTimeDate(data.checkInTime),
      checkOutTime: toTimeDate(data.checkOutTime),
    },
  })

  await logAdjustment("UPDATE", data.name)
  revalidatePath("/admin/jam-kerja")
  return { success: true }
}

export async function deleteWorkShiftAdjustmentAction(id: number) {
  const adjustment = await prisma.workShiftAdjustment.findUnique({ where: { id } })
  await prisma.workShiftAdjustment.delete({ where: { id } })
  if (adjustment) {
    await logAdjustment("DELETE", adjustment.name)
  }
  revalidatePath("/admin/jam-kerja")
}
