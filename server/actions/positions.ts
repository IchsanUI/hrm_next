"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { nameOnlySchema } from "@/lib/validations/master-data"

export type MasterDataState = { error?: string; success?: boolean } | undefined

async function logPosition(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "Position",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } jabatan "${name}".`,
  })
}

export async function createPositionAction(
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = nameOnlySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Nama jabatan wajib diisi." }
  }
  try {
    await prisma.position.create({ data: { name: parsed.data.name } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Jabatan dengan nama tersebut sudah ada." }
    }
    throw err
  }
  await logPosition("CREATE", parsed.data.name)
  revalidatePath("/admin/jabatan")
  return { success: true }
}

export async function updatePositionAction(
  id: number,
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = nameOnlySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Nama jabatan wajib diisi." }
  }
  try {
    await prisma.position.update({
      where: { id },
      data: { name: parsed.data.name },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Jabatan dengan nama tersebut sudah ada." }
    }
    throw err
  }
  await logPosition("UPDATE", parsed.data.name)
  revalidatePath("/admin/jabatan")
  return { success: true }
}

export async function deletePositionAction(id: number) {
  const position = await prisma.position.findUnique({ where: { id } })
  try {
    await prisma.position.delete({ where: { id } })
  } catch {
    return { error: "Jabatan masih dipakai oleh data pegawai, tidak bisa dihapus." }
  }
  if (position) {
    await logPosition("DELETE", position.name)
  }
  revalidatePath("/admin/jabatan")
  return undefined
}
