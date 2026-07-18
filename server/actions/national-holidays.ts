"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { nationalHolidaySchema } from "@/lib/validations/master-data"

export type MasterDataState = { error?: string; success?: boolean } | undefined

async function logHoliday(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "NationalHoliday",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } hari libur "${name}".`,
  })
}

export async function createNationalHolidayAction(
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = nationalHolidaySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan nama hari libur wajib diisi." }
  }
  await prisma.nationalHoliday.create({
    data: { date: new Date(parsed.data.date), name: parsed.data.name },
  })
  await logHoliday("CREATE", parsed.data.name)
  revalidatePath("/admin/hari-libur")
  return { success: true }
}

export async function updateNationalHolidayAction(
  id: number,
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = nationalHolidaySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan nama hari libur wajib diisi." }
  }
  await prisma.nationalHoliday.update({
    where: { id },
    data: { date: new Date(parsed.data.date), name: parsed.data.name },
  })
  await logHoliday("UPDATE", parsed.data.name)
  revalidatePath("/admin/hari-libur")
  return { success: true }
}

export async function deleteNationalHolidayAction(id: number) {
  const holiday = await prisma.nationalHoliday.findUnique({ where: { id } })
  await prisma.nationalHoliday.delete({ where: { id } })
  if (holiday) {
    await logHoliday("DELETE", holiday.name)
  }
  revalidatePath("/admin/hari-libur")
}
