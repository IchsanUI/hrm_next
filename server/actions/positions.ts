"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { positionSchema } from "@/lib/validations/position"

export type PositionState = { error?: string } | undefined

function parseOptionalNumber(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

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
  _prevState: PositionState,
  formData: FormData
): Promise<PositionState> {
  const parsed = positionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  try {
    await prisma.position.create({
      data: { name: data.name, attendanceRatePerDay: parseOptionalNumber(data.attendanceRatePerDay) },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Jabatan dengan nama tersebut sudah ada." }
    }
    throw err
  }
  await logPosition("CREATE", data.name)
  revalidatePath("/admin/jabatan")
  return undefined
}

export async function updatePositionAction(
  id: number,
  _prevState: PositionState,
  formData: FormData
): Promise<PositionState> {
  const parsed = positionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  try {
    await prisma.position.update({
      where: { id },
      data: { name: data.name, attendanceRatePerDay: parseOptionalNumber(data.attendanceRatePerDay) },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Jabatan dengan nama tersebut sudah ada." }
    }
    throw err
  }
  await logPosition("UPDATE", data.name)
  revalidatePath("/admin/jabatan")
  return undefined
}

export async function deletePositionAction(id: number): Promise<PositionState> {
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
